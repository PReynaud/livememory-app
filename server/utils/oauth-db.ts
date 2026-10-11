import type { McpSupabaseEnv } from './personal-key-exchange';
import {
  readBearerToken,
  type OauthStore
} from './oauth';

const rpc = async <T>(
  env: McpSupabaseEnv,
  name: string,
  args: Record<string, unknown>
): Promise<T> => {
  const response = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'apikey': env.serviceRoleKey,
      'Authorization': `Bearer ${env.serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `${name} failed`);
  }

  if (!text) {
    return null as T;
  }

  return JSON.parse(text) as T;
};

export const readSignedInUserId = async (
  authorization: string | undefined,
  env: McpSupabaseEnv
): Promise<string | null> => {
  const accessToken = readBearerToken(authorization);
  if (!accessToken || !env.supabaseUrl || !env.anonKey) {
    return null;
  }

  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: env.anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    return null;
  }

  const body = await response.json() as { id?: unknown };
  return typeof body.id === 'string' && body.id.length > 0 ? body.id : null;
};

export const createSupabaseOauthStore = (env: McpSupabaseEnv): OauthStore => ({
  registerClient: (clientName, redirectUris) => {
    return rpc<string>(env, 'register_oauth_client', {
      p_client_name: clientName,
      p_redirect_uris: redirectUris
    });
  },
  findClientForRedirect: async (clientId, redirectUri) => {
    const row = await rpc<{ client_name?: string } | null>(env, 'oauth_client_for_redirect', {
      p_client_id: clientId,
      p_redirect_uri: redirectUri
    });
    if (!row || typeof row.client_name !== 'string' || row.client_name.length === 0) {
      return null;
    }

    return { clientName: row.client_name };
  },
  issueAuthorizationCode: (input) => {
    return rpc<string>(env, 'issue_oauth_authorization_code', {
      p_user_id: input.userId,
      p_client_id: input.clientId,
      p_redirect_uri: input.redirectUri,
      p_code_challenge: input.codeChallenge,
      p_code_hash: input.codeHash,
      p_expires_at: input.expiresAt
    });
  },
  redeemAuthorizationCode: async (input) => {
    const row = await rpc<{
      status?: string;
      user_id?: string | null;
      grant_id?: string | null;
    }>(env, 'redeem_oauth_authorization_code', {
      p_code_hash: input.codeHash,
      p_client_id: input.clientId,
      p_redirect_uri: input.redirectUri,
      p_code_challenge: input.codeChallenge,
      p_access_hash: input.accessTokenHash,
      p_access_expires_at: input.accessExpiresAt,
      p_refresh_hash: input.refreshTokenHash
    });
    const status = row?.status;
    if (
      status !== 'ok'
      && status !== 'invalid'
      && status !== 'reused'
      && status !== 'expired'
      && status !== 'redirect_mismatch'
      && status !== 'bad_verifier'
      && status !== 'revoked'
    ) {
      return { status: 'invalid', userId: null, grantId: null };
    }

    return {
      status,
      userId: typeof row.user_id === 'string' ? row.user_id : null,
      grantId: typeof row.grant_id === 'string' ? row.grant_id : null
    };
  },
  lookupAccessUserId: (accessTokenHash) => {
    return rpc<string | null>(env, 'lookup_oauth_access_token', {
      p_token_hash: accessTokenHash
    });
  },
  rotateRefreshToken: (input) => {
    return rpc<string | null>(env, 'rotate_oauth_refresh_token', {
      p_refresh_hash: input.refreshTokenHash,
      p_client_id: input.clientId,
      p_access_hash: input.accessTokenHash,
      p_access_expires_at: input.accessExpiresAt,
      p_next_refresh_hash: input.nextRefreshTokenHash
    });
  }
});
