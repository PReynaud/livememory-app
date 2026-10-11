import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZATION_CODE_TTL_MS,
  authorizationServerMetadata,
  decideOauthAuthorization,
  exchangeOauthToken,
  hashOpaqueSecret,
  isAllowedRedirectUri,
  mcpResourceUrl,
  mcpWwwAuthenticate,
  pkceS256,
  protectedResourceMetadata,
  registerOauthClient,
  type OauthStore
} from '../../server/utils/oauth';
import { resolveMcpAccess } from '../../server/utils/mcp-access';
import {
  listOauthGrants,
  OAUTH_GRANT_COLUMNS,
  revokeOauthGrant,
  type OauthDirectoryClient
} from '../../shared/domain/oauth-grants';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const REDIRECT = 'http://127.0.0.1:9/callback';
const ORIGIN = 'http://127.0.0.1:3000';

type MemoryClient = {
  id: string;
  clientName: string;
  redirectUris: string[];
};

type MemoryGrant = {
  id: string;
  userId: string;
  clientId: string;
  accessTokenHash: string | null;
  accessExpiresAt: string | null;
  refreshTokenHash: string | null;
  previousRefreshTokenHash: string | null;
};

type MemoryCode = {
  codeHash: string;
  clientId: string;
  userId: string;
  grantId: string | null;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: string;
  usedAt: string | null;
};

const createMemoryOauthStore = (clock: () => Date) => {
  const clients: MemoryClient[] = [];
  const grants: MemoryGrant[] = [];
  const codes: MemoryCode[] = [];

  const store: OauthStore = {
    registerClient: async (clientName, redirectUris) => {
      const id = randomUUID();
      clients.push({ id, clientName, redirectUris });
      return id;
    },
    findClientForRedirect: async (clientId, redirectUri) => {
      const client = clients.find(entry => entry.id === clientId && entry.redirectUris.includes(redirectUri));
      return client ? { clientName: client.clientName } : null;
    },
    issueAuthorizationCode: async (input) => {
      codes.push({
        codeHash: input.codeHash,
        clientId: input.clientId,
        userId: input.userId,
        grantId: null,
        redirectUri: input.redirectUri,
        codeChallenge: input.codeChallenge,
        expiresAt: input.expiresAt,
        usedAt: null
      });
      return input.clientId;
    },
    redeemAuthorizationCode: async (input) => {
      const code = codes.find(entry => entry.codeHash === input.codeHash);
      if (!code) {
        return { status: 'invalid', userId: null, grantId: null };
      }

      if (code.usedAt) {
        const index = grants.findIndex(grant => grant.id === code.grantId);
        if (index >= 0) {
          grants.splice(index, 1);
        }

        return { status: 'reused', userId: null, grantId: null };
      }

      if (new Date(code.expiresAt).getTime() <= clock().getTime()) {
        return { status: 'expired', userId: null, grantId: null };
      }

      if (code.clientId !== input.clientId || code.redirectUri !== input.redirectUri) {
        return { status: 'redirect_mismatch', userId: null, grantId: null };
      }

      if (code.codeChallenge !== input.codeChallenge) {
        return { status: 'bad_verifier', userId: null, grantId: null };
      }

      if (code.grantId && !grants.some(grant => grant.id === code.grantId)) {
        return { status: 'revoked', userId: null, grantId: null };
      }

      const grantId = code.grantId ?? randomUUID();
      if (!code.grantId) {
        grants.push({
          id: grantId,
          userId: code.userId,
          clientId: code.clientId,
          accessTokenHash: input.accessTokenHash,
          accessExpiresAt: input.accessExpiresAt,
          refreshTokenHash: input.refreshTokenHash,
          previousRefreshTokenHash: null
        });
      } else {
        const grant = grants.find(entry => entry.id === code.grantId && entry.accessTokenHash === null);
        if (!grant) {
          return { status: 'revoked', userId: null, grantId: null };
        }

        grant.accessTokenHash = input.accessTokenHash;
        grant.accessExpiresAt = input.accessExpiresAt;
        grant.refreshTokenHash = input.refreshTokenHash;
      }

      code.usedAt = clock().toISOString();
      code.grantId = grantId;
      return { status: 'ok', userId: code.userId, grantId };
    },
    lookupAccessUserId: async (accessTokenHash) => {
      const grant = grants.find(entry => entry.accessTokenHash === accessTokenHash);
      if (!grant?.accessExpiresAt || new Date(grant.accessExpiresAt).getTime() <= clock().getTime()) {
        return null;
      }

      return grant.userId;
    },
    rotateRefreshToken: async (input) => {
      const replayIndex = grants.findIndex(entry => (
        entry.previousRefreshTokenHash === input.refreshTokenHash
        && entry.clientId === input.clientId
      ));
      if (replayIndex >= 0) {
        grants.splice(replayIndex, 1);
        return null;
      }

      const grant = grants.find(entry => (
        entry.refreshTokenHash === input.refreshTokenHash
        && entry.clientId === input.clientId
      ));
      if (!grant) {
        return null;
      }

      grant.previousRefreshTokenHash = grant.refreshTokenHash;
      grant.accessTokenHash = input.accessTokenHash;
      grant.accessExpiresAt = input.accessExpiresAt;
      grant.refreshTokenHash = input.nextRefreshTokenHash;
      return grant.userId;
    }
  };

  return {
    store,
    clients,
    grants,
    codes,
    revoke: (userId: string, grantId: string) => {
      const index = grants.findIndex(grant => grant.id === grantId && grant.userId === userId);
      if (index < 0) {
        return false;
      }

      const [removed] = grants.splice(index, 1);
      for (let cursor = codes.length - 1; cursor >= 0; cursor -= 1) {
        if (codes[cursor]?.grantId === removed?.id) {
          codes.splice(cursor, 1);
        }
      }

      return true;
    }
  };
};

const verifier = () => pkceS256('placeholder');

const freshVerifier = () => {
  const value = `verifier-${randomUUID()}-verifier-${randomUUID()}`.replace(/[^A-Za-z0-9._~-]/g, '');
  return value.slice(0, 64);
};

const allowInput = (
  clientId: string,
  userId: string,
  codeVerifier: string,
  decision: 'allow' | 'deny' = 'allow'
) => ({
  decision,
  userId,
  clientId,
  redirectUri: REDIRECT,
  responseType: 'code',
  codeChallenge: pkceS256(codeVerifier),
  codeChallengeMethod: 'S256',
  state: 'state-1',
  resource: '',
  origin: ORIGIN
});

const codeFromRedirect = (redirect: string) => new URL(redirect).searchParams.get('code') ?? '';

describe('OAuth discovery metadata', () => {
  it('advertises the MCP resource, authorization code, PKCE S256, refresh, and registration', () => {
    const resource = protectedResourceMetadata(ORIGIN);
    const server = authorizationServerMetadata(ORIGIN);

    expect(resource.resource).toBe(`${ORIGIN}/api/mcp`);
    expect(resource.authorization_servers).toEqual([ORIGIN]);
    expect(server.response_types_supported).toEqual(['code']);
    expect(server.grant_types_supported).toContain('authorization_code');
    expect(server.grant_types_supported).toContain('refresh_token');
    expect(server.code_challenge_methods_supported).toEqual(['S256']);
    expect(server.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(server.registration_endpoint).toBe(`${ORIGIN}/api/oauth/register`);
    expect(mcpWwwAuthenticate(ORIGIN)).toContain('/.well-known/oauth-protected-resource/api/mcp');
    expect(JSON.stringify(resource)).not.toContain('/login');
    expect(JSON.stringify(server)).not.toContain('/login');
  });
});

describe('OAuth connect, PKCE, and revoke', () => {
  it('allows a public client, rejects a bad verifier, reused code, and mismatched redirect, then revokes one user only', async () => {
    const now = new Date('2026-10-11T10:00:00.000Z');
    const memory = createMemoryOauthStore(() => now);
    const registered = await registerOauthClient(memory.store, {
      client_name: 'Cursor',
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: 'none'
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const secretRejected = await registerOauthClient(memory.store, {
      client_name: 'Secret',
      redirect_uris: [REDIRECT],
      client_secret: 'nope'
    });
    expect(secretRejected.ok).toBe(false);
    if (!secretRejected.ok) {
      expect(secretRejected.status).toBe(400);
      expect(secretRejected.body).not.toHaveProperty('access_token');
    }

    const issueCode = async () => {
      const codeVerifier = freshVerifier();
      const allowed = await decideOauthAuthorization(
        memory.store,
        allowInput(registered.body.client_id, USER_A, codeVerifier),
        now
      );
      expect(allowed.ok).toBe(true);
      if (!allowed.ok) {
        throw new Error('allow failed');
      }

      const code = codeFromRedirect(allowed.redirect);
      expect(allowed.redirect).toContain('state=state-1');
      expect(memory.codes.some(entry => entry.codeHash === hashOpaqueSecret(code))).toBe(true);
      expect(JSON.stringify(memory.codes)).not.toContain(code);
      return { code, codeVerifier };
    };

    const bad = await issueCode();
    const badVerifier = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code: bad.code,
      redirect_uri: REDIRECT,
      client_id: registered.body.client_id,
      code_verifier: freshVerifier()
    }, now);
    expect(badVerifier.ok).toBe(false);
    if (!badVerifier.ok) {
      expect(badVerifier.status).toBe(400);
      expect(badVerifier.body).not.toHaveProperty('access_token');
    }

    const mismatched = await issueCode();
    const mismatch = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code: mismatched.code,
      redirect_uri: 'http://127.0.0.1:9/other',
      client_id: registered.body.client_id,
      code_verifier: mismatched.codeVerifier
    }, now);
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.status).toBe(400);
      expect(mismatch.body).not.toHaveProperty('access_token');
    }

    const once = await issueCode();
    const firstUse = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code: once.code,
      redirect_uri: REDIRECT,
      client_id: registered.body.client_id,
      code_verifier: once.codeVerifier
    }, now);
    expect(firstUse.ok).toBe(true);
    const reused = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code: once.code,
      redirect_uri: REDIRECT,
      client_id: registered.body.client_id,
      code_verifier: once.codeVerifier
    }, now);
    expect(reused.ok).toBe(false);
    if (!reused.ok) {
      expect(reused.status).toBe(400);
      expect(reused.body).not.toHaveProperty('access_token');
    }
    expect(memory.grants.every(grant => !JSON.stringify(grant).includes(once.code))).toBe(true);
  });

  it('returns access and refresh tokens, expires access after one hour, and revokes only that user', async () => {
    let now = new Date('2026-10-11T10:00:00.000Z');
    const memory = createMemoryOauthStore(() => now);
    const registered = await registerOauthClient(memory.store, {
      client_name: 'Cursor',
      redirect_uris: [REDIRECT]
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const connect = async (userId: string) => {
      const codeVerifier = freshVerifier();
      const allowed = await decideOauthAuthorization(
        memory.store,
        allowInput(registered.body.client_id, userId, codeVerifier),
        now
      );
      expect(allowed.ok).toBe(true);
      if (!allowed.ok) {
        throw new Error('allow failed');
      }

      const tokens = await exchangeOauthToken(memory.store, {
        grant_type: 'authorization_code',
        code: codeFromRedirect(allowed.redirect),
        redirect_uri: REDIRECT,
        client_id: registered.body.client_id,
        code_verifier: codeVerifier
      }, now);
      expect(tokens.ok).toBe(true);
      if (!tokens.ok) {
        throw new Error('token failed');
      }

      expect(tokens.body.expires_in).toBe(ACCESS_TOKEN_TTL_SECONDS);
      expect(tokens.body.token_type).toBe('Bearer');
      expect(JSON.stringify(memory.grants)).not.toContain(tokens.body.access_token);
      expect(JSON.stringify(memory.grants)).not.toContain(tokens.body.refresh_token);
      return tokens.body;
    };

    const first = await connect(USER_A);
    const second = await connect(USER_B);
    expect(await memory.store.lookupAccessUserId(hashOpaqueSecret(first.access_token))).toBe(USER_A);
    expect(await memory.store.lookupAccessUserId(hashOpaqueSecret(second.access_token))).toBe(USER_B);

    const rotated = await exchangeOauthToken(memory.store, {
      grant_type: 'refresh_token',
      refresh_token: first.refresh_token,
      client_id: registered.body.client_id
    }, now);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) {
      return;
    }

    const staleRefresh = await exchangeOauthToken(memory.store, {
      grant_type: 'refresh_token',
      refresh_token: first.refresh_token,
      client_id: registered.body.client_id
    }, now);
    expect(staleRefresh.ok).toBe(false);
    if (!staleRefresh.ok) {
      expect(staleRefresh.status).toBe(401);
      expect(staleRefresh.body).not.toHaveProperty('access_token');
    }

    now = new Date(now.getTime() + (ACCESS_TOKEN_TTL_SECONDS + 60) * 1000);
    expect(await memory.store.lookupAccessUserId(hashOpaqueSecret(rotated.body.access_token))).toBeNull();

    now = new Date('2026-10-11T10:00:00.000Z');
    const again = await connect(USER_A);
    const grant = memory.grants.find(entry => entry.accessTokenHash === hashOpaqueSecret(again.access_token));
    expect(grant).toBeTruthy();
    expect(memory.revoke(USER_B, grant!.id)).toBe(false);
    expect(memory.revoke(USER_A, grant!.id)).toBe(true);
    expect(await memory.store.lookupAccessUserId(hashOpaqueSecret(again.access_token))).toBeNull();

    const revokedRefresh = await exchangeOauthToken(memory.store, {
      grant_type: 'refresh_token',
      refresh_token: again.refresh_token,
      client_id: registered.body.client_id
    }, now);
    expect(revokedRefresh.ok).toBe(false);
    if (!revokedRefresh.ok) {
      expect(revokedRefresh.status).toBe(401);
    }

    expect(await memory.store.lookupAccessUserId(hashOpaqueSecret(second.access_token))).toBe(USER_B);
  });

  it('deny redirects with access_denied and stores no code', async () => {
    const now = new Date('2026-10-11T10:00:00.000Z');
    const memory = createMemoryOauthStore(() => now);
    const registered = await registerOauthClient(memory.store, {
      client_name: 'Cursor',
      redirect_uris: [REDIRECT]
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const denied = await decideOauthAuthorization(
      memory.store,
      allowInput(registered.body.client_id, USER_A, freshVerifier(), 'deny'),
      now
    );
    expect(denied.ok).toBe(true);
    if (!denied.ok) {
      return;
    }

    const url = new URL(denied.redirect);
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.get('code')).toBeNull();
    expect(memory.codes).toHaveLength(0);
    expect(memory.grants).toHaveLength(0);
  });

  it('rejects loopback lookalikes and keeps https redirects', () => {
    expect(isAllowedRedirectUri('https://example.com/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:3847/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://evil.com/callback')).toBe(false);
    expect(isAllowedRedirectUri('http://localhost.evil.com/callback')).toBe(false);
    expect(isAllowedRedirectUri('https://user:pass@example.com/callback')).toBe(false);
    expect(isAllowedRedirectUri('https://example.com?x=1')).toBe(false);
    expect(isAllowedRedirectUri('HTTP://127.0.0.1/callback')).toBe(false);
    expect(isAllowedRedirectUri('https://bad_host.example/cb')).toBe(false);
    expect(isAllowedRedirectUri('http://localhost./callback')).toBe(false);
    expect(verifier()).toHaveLength(43);
  });

  it('rejects a wrong resource, an unsafe state, and a code past its TTL without issuing a token', async () => {
    let now = new Date('2026-10-11T10:00:00.000Z');
    const memory = createMemoryOauthStore(() => now);
    const registered = await registerOauthClient(memory.store, {
      client_name: 'Cursor',
      redirect_uris: [REDIRECT]
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const codeVerifier = freshVerifier();
    const wrongResource = await decideOauthAuthorization(memory.store, {
      ...allowInput(registered.body.client_id, USER_A, codeVerifier),
      resource: 'https://evil.example/api/mcp'
    }, now);
    expect(wrongResource.ok).toBe(false);
    if (!wrongResource.ok) {
      expect(wrongResource.status).toBe(400);
    }
    expect(memory.codes).toHaveLength(0);

    const unsafeState = await decideOauthAuthorization(memory.store, {
      ...allowInput(registered.body.client_id, USER_A, codeVerifier),
      state: `safe${String.fromCharCode(10)}`
    }, now);
    expect(unsafeState.ok).toBe(false);
    if (!unsafeState.ok) {
      expect(unsafeState.status).toBe(400);
    }
    expect(memory.codes).toHaveLength(0);

    const longState = await decideOauthAuthorization(memory.store, {
      ...allowInput(registered.body.client_id, USER_A, codeVerifier),
      state: 's'.repeat(513)
    }, now);
    expect(longState.ok).toBe(false);
    expect(memory.codes).toHaveLength(0);

    const allowed = await decideOauthAuthorization(memory.store, {
      ...allowInput(registered.body.client_id, USER_A, codeVerifier),
      resource: mcpResourceUrl(ORIGIN)
    }, now);
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) {
      return;
    }

    expect(memory.grants).toHaveLength(0);
    const code = codeFromRedirect(allowed.redirect);
    now = new Date(now.getTime() + AUTHORIZATION_CODE_TTL_MS);
    const expired = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: registered.body.client_id,
      code_verifier: codeVerifier
    }, now);
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.status).toBe(400);
      expect(expired.body.error).toBe('invalid_grant');
    }
    expect(memory.codes[0]?.usedAt).toBeNull();
    expect(memory.grants).toHaveLength(0);
  });

  it('keeps a code redeemable after a bad verifier or redirect, and reuse kills the access token', async () => {
    const now = new Date('2026-10-11T10:00:00.000Z');
    const memory = createMemoryOauthStore(() => now);
    const registered = await registerOauthClient(memory.store, {
      client_name: 'Cursor',
      redirect_uris: [REDIRECT, 'http://127.0.0.1:9/other']
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const otherClient = await registerOauthClient(memory.store, {
      client_name: 'Other',
      redirect_uris: [REDIRECT]
    });
    expect(otherClient.ok).toBe(true);
    if (!otherClient.ok) {
      return;
    }

    const codeVerifier = freshVerifier();
    const allowed = await decideOauthAuthorization(
      memory.store,
      allowInput(registered.body.client_id, USER_A, codeVerifier),
      now
    );
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) {
      return;
    }

    const code = codeFromRedirect(allowed.redirect);
    const badVerifier = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: registered.body.client_id,
      code_verifier: freshVerifier()
    }, now);
    expect(badVerifier.ok).toBe(false);
    expect(memory.codes[0]?.usedAt).toBeNull();

    const mismatch = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://127.0.0.1:9/other',
      client_id: registered.body.client_id,
      code_verifier: codeVerifier
    }, now);
    expect(mismatch.ok).toBe(false);
    expect(memory.codes[0]?.usedAt).toBeNull();

    const redeemed = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: registered.body.client_id,
      code_verifier: codeVerifier
    }, now);
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) {
      return;
    }

    expect(await memory.store.lookupAccessUserId(hashOpaqueSecret(redeemed.body.access_token))).toBe(USER_A);

    const wrongClient = await exchangeOauthToken(memory.store, {
      grant_type: 'refresh_token',
      refresh_token: redeemed.body.refresh_token,
      client_id: otherClient.body.client_id
    }, now);
    expect(wrongClient.ok).toBe(false);
    if (!wrongClient.ok) {
      expect(wrongClient.status).toBe(401);
    }

    const rotated = await exchangeOauthToken(memory.store, {
      grant_type: 'refresh_token',
      refresh_token: redeemed.body.refresh_token,
      client_id: registered.body.client_id
    }, now);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) {
      return;
    }

    const replay = await exchangeOauthToken(memory.store, {
      grant_type: 'refresh_token',
      refresh_token: redeemed.body.refresh_token,
      client_id: otherClient.body.client_id
    }, now);
    expect(replay.ok).toBe(false);
    expect(await memory.store.lookupAccessUserId(hashOpaqueSecret(rotated.body.access_token))).toBe(USER_A);

    const killed = await exchangeOauthToken(memory.store, {
      grant_type: 'refresh_token',
      refresh_token: redeemed.body.refresh_token,
      client_id: registered.body.client_id
    }, now);
    expect(killed.ok).toBe(false);
    if (!killed.ok) {
      expect(killed.status).toBe(401);
    }
    expect(await memory.store.lookupAccessUserId(hashOpaqueSecret(rotated.body.access_token))).toBeNull();

    const secondVerifier = freshVerifier();
    const secondAllow = await decideOauthAuthorization(
      memory.store,
      allowInput(registered.body.client_id, USER_A, secondVerifier),
      now
    );
    expect(secondAllow.ok).toBe(true);
    if (!secondAllow.ok) {
      return;
    }

    const secondCode = codeFromRedirect(secondAllow.redirect);
    const secondTokens = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code: secondCode,
      redirect_uri: REDIRECT,
      client_id: registered.body.client_id,
      code_verifier: secondVerifier
    }, now);
    expect(secondTokens.ok).toBe(true);
    if (!secondTokens.ok) {
      return;
    }

    const reused = await exchangeOauthToken(memory.store, {
      grant_type: 'authorization_code',
      code: secondCode,
      redirect_uri: REDIRECT,
      client_id: registered.body.client_id,
      code_verifier: secondVerifier
    }, now);
    expect(reused.ok).toBe(false);
    expect(await memory.store.lookupAccessUserId(hashOpaqueSecret(secondTokens.body.access_token))).toBeNull();
  });

  it('rejects control or bidi client names and more than eight redirect URLs', async () => {
    const memory = createMemoryOauthStore(() => new Date('2026-10-11T10:00:00.000Z'));
    const bidi = await registerOauthClient(memory.store, {
      client_name: `Cursor${String.fromCharCode(0x202E)}`,
      redirect_uris: [REDIRECT]
    });
    expect(bidi.ok).toBe(false);
    if (!bidi.ok) {
      expect(bidi.status).toBe(400);
      expect(bidi.body.error).toBe('invalid_request');
    }

    const control = await registerOauthClient(memory.store, {
      client_name: 'Cursor\n',
      redirect_uris: [REDIRECT]
    });
    expect(control.ok).toBe(false);

    const tooMany = await registerOauthClient(memory.store, {
      client_name: 'Cursor',
      redirect_uris: Array.from({ length: 9 }, (_, index) => `http://127.0.0.1:${index + 1}/callback`)
    });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) {
      expect(tooMany.status).toBe(400);
    }

    const queryWithoutSlash = await registerOauthClient(memory.store, {
      client_name: 'Cursor',
      redirect_uris: ['https://example.com?x=1']
    });
    expect(queryWithoutSlash.ok).toBe(false);
    if (!queryWithoutSlash.ok) {
      expect(queryWithoutSlash.status).toBe(400);
      expect(queryWithoutSlash.body.error).toBe('invalid_request');
    }
    expect(memory.clients).toHaveLength(0);

    const route = read('server/api/oauth/register.post.ts');
    expect(route).toContain('invalid_request');
    expect(route).toMatch(/sendOauthJson\(event, 400/);
    expect(route).toContain('invalid redirect uri');
  });
});

describe('MCP missing bearer', () => {
  it('returns 401 with protected-resource metadata and does not resolve a user', async () => {
    const lookup = vi.fn();
    const missing = await resolveMcpAccess(undefined, ORIGIN, lookup);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.status).toBe(401);
      expect(missing.wwwAuthenticate).toContain('resource_metadata=');
      expect(missing.wwwAuthenticate).toContain('/.well-known/oauth-protected-resource');
    }
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('OAuth grants on Profile', () => {
  it('lists and revokes only the signed-in user grants', async () => {
    const rows = [
      {
        id: 'grant-a',
        user_id: USER_A,
        client_id: 'client-1',
        client_name: 'Cursor',
        created_at: '2026-10-11T10:00:00.000Z',
        has_access_token: true
      },
      {
        id: 'grant-pending',
        user_id: USER_A,
        client_id: 'client-1',
        client_name: 'Cursor',
        created_at: '2026-10-11T10:05:00.000Z',
        has_access_token: false
      },
      {
        id: 'grant-b',
        user_id: USER_B,
        client_id: 'client-2',
        client_name: 'ChatGPT',
        created_at: '2026-10-11T11:00:00.000Z',
        has_access_token: true
      }
    ];

    const client: OauthDirectoryClient = {
      from: relation => ({
        select: (columns) => {
          expect(columns).toBe(relation === 'oauth_grants' ? OAUTH_GRANT_COLUMNS : 'id, client_name');
          expect(columns).not.toContain('hash');
          const filters: Record<string, string | boolean> = {};
          const chain = () => ({
            eq: (column: string, value: string | boolean) => {
              filters[column] = value;
              return chain();
            },
            order: async () => ({
              data: rows
                .filter(row => (
                  row.user_id === filters.user_id
                  && (filters.has_access_token !== true || row.has_access_token)
                ))
                .map(row => ({
                  id: row.id,
                  client_id: row.client_id,
                  created_at: row.created_at,
                  oauth_clients: { client_name: row.client_name }
                })),
              error: null
            }),
            maybeSingle: async () => ({ data: null, error: null })
          });
          return {
            eq: (column: string, value: string | boolean) => {
              filters[column] = value;
              return chain();
            }
          };
        },
        delete: () => ({
          eq: (_column, grantId) => ({
            eq: async (userColumn, userId) => {
              const next = rows.filter(row => !(row.id === grantId && row[userColumn as 'user_id'] === userId));
              rows.splice(0, rows.length, ...next);
              return { data: null, error: null };
            }
          })
        })
      })
    };

    const listed = await listOauthGrants(client, USER_A);
    expect(listed.data).toEqual([{
      id: 'grant-a',
      clientName: 'Cursor',
      createdAt: '2026-10-11T10:00:00.000Z'
    }]);

    const revoked = await revokeOauthGrant(client, USER_A, 'grant-b');
    expect(revoked.error).toBeNull();
    expect(rows.map(row => row.id)).toEqual(['grant-a', 'grant-pending', 'grant-b']);

    await revokeOauthGrant(client, USER_A, 'grant-a');
    expect(rows.map(row => row.id)).toEqual(['grant-pending', 'grant-b']);

    const empty = await listOauthGrants(client, USER_A);
    expect(empty.data).toEqual([]);
  });

  it('shows an empty state and no personal-key control', () => {
    const page = read('app/pages/profile.vue');
    expect(page).toContain('OAUTH_GRANTS_EMPTY');
    expect(page).toContain('oauth-grants-empty');
    expect(page).toContain('!grantsError');
    expect(page).toContain('Revoke');
    const storeSource = read('app/stores/oauth-grants.ts');
    const fetchGrants = storeSource.slice(
      storeSource.indexOf('const fetchGrants'),
      storeSource.indexOf('const revokeGrant')
    );
    expect(fetchGrants.indexOf('grants.value = []')).toBeLessThan(fetchGrants.indexOf('listOauthGrants'));
    expect(fetchGrants).toMatch(/catch[\s\S]*grants\.value = \[\]/);
    expect(fetchGrants).toContain('if (!userId)');
    const consent = read('app/pages/oauth/authorize.vue');
    expect(consent).toContain('if (submitting.value || loading.value)');
    expect(consent).toContain('isAllowedRedirectUri');
    expect(consent).toContain('!redirectIsSafe');
    expect(consent).toContain('fetchClient(clientId.value)');
    expect(page).not.toContain('personal-key');
    expect(page).not.toContain('Create personal key');
    expect(page).not.toContain('lm_');
  });
});

describe('OAuth schema', () => {
  it('drops personal keys and keeps hashed grants behind user revoke and a service_role lookup', () => {
    const sql = read('supabase/migrations/20261011085000_oauth_mcp_grants.sql');
    expect(sql).toMatch(/drop table if exists public\.personal_keys/);
    expect(sql).toMatch(/drop function if exists public\.lookup_personal_key_user\(text\)/);
    expect(sql).toMatch(/create table public\.oauth_clients/);
    expect(sql).toMatch(/create table public\.oauth_authorization_codes/);
    expect(sql).toMatch(/create table public\.oauth_grants/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/\(select auth\.uid\(\)\) = user_id/);
    expect(sql).toMatch(/grant delete on table public\.oauth_grants to authenticated/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/lookup_oauth_access_token/);
    expect(sql).toMatch(/grant execute on function public\.lookup_oauth_access_token\(text\) to service_role/);
    expect(sql).not.toMatch(/from public\.events/);
    expect(sql).not.toMatch(/from public\.concerts/);
    expect(sql).not.toMatch(/from public\.attendance/);
    expect(sql).not.toMatch(/from public\.event_members/);
    expect(sql).not.toMatch(/from public\.event_stages/);
    expect(sql).not.toMatch(/on table public\.oauth_grants to service_role/);
    expect(sql).not.toMatch(/on table public\.oauth_clients to service_role/);
    expect(sql).not.toMatch(/on table public\.oauth_authorization_codes to service_role/);

    const types = read('app/types/database.types.ts');
    expect(types).not.toContain('personal_keys');
    expect(types).toContain('oauth_grants');
    expect(types).toContain('has_access_token');
    expect(types).toContain('previous_refresh_token_hash');
    expect(types).not.toContain('lookup_personal_key_user');

    const redeemFix = read('supabase/migrations/20261011120000_oauth_redeem_and_refresh_reuse.sql');
    const redeem = redeemFix.slice(redeemFix.indexOf('function public.redeem_oauth_authorization_code'));
    const usedAt = redeem.indexOf('v_row.used_at is not null');
    const deleted = redeem.indexOf('delete from public.oauth_grants');
    const expired = redeem.indexOf('expires_at <= pg_catalog.now()');
    const setUsed = redeem.indexOf('set used_at');
    expect(usedAt).toBeGreaterThan(-1);
    expect(deleted).toBeGreaterThan(usedAt);
    expect(expired).toBeGreaterThan(deleted);
    expect(redeem.indexOf('bad_verifier')).toBeGreaterThan(expired);
    expect(setUsed).toBeGreaterThan(redeem.indexOf('bad_verifier'));
    expect(redeemFix).toMatch(/cardinality\(p_redirect_uris\) > 8/);
    expect(redeemFix).toMatch(/\[\[:cntrl:\]\]/);

    const mcpConfig = read('.cursor/mcp.json');
    expect(mcpConfig).not.toContain('Authorization');
    expect(mcpConfig).toContain('/api/mcp');
  });
});
