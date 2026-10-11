import { createHash, randomBytes } from 'node:crypto';
import { isAllowedRedirectUri } from '../../shared/domain/oauth-redirect';

export { isAllowedRedirectUri } from '../../shared/domain/oauth-redirect';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000;

const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;
const CLIENT_NAME_MAX = 120;
const REDIRECT_URI_LIMIT = 8;
const STATE_MAX = 512;
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OauthStore = {
  registerClient: (clientName: string, redirectUris: string[]) => Promise<string>;
  findClientForRedirect: (
    clientId: string,
    redirectUri: string
  ) => Promise<{ clientName: string } | null>;
  issueAuthorizationCode: (input: {
    userId: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeHash: string;
    expiresAt: string;
  }) => Promise<string>;
  redeemAuthorizationCode: (input: {
    codeHash: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    accessTokenHash: string;
    accessExpiresAt: string;
    refreshTokenHash: string;
  }) => Promise<{
    status: 'ok' | 'invalid' | 'reused' | 'expired' | 'redirect_mismatch' | 'bad_verifier' | 'revoked';
    userId: string | null;
    grantId: string | null;
  }>;
  lookupAccessUserId: (accessTokenHash: string) => Promise<string | null>;
  rotateRefreshToken: (input: {
    refreshTokenHash: string;
    clientId: string;
    accessTokenHash: string;
    accessExpiresAt: string;
    nextRefreshTokenHash: string;
  }) => Promise<string | null>;
};

export type OauthErrorBody = {
  error: 'invalid_request' | 'invalid_grant' | 'invalid_client';
  error_description: string;
};

export type TokenSuccessBody = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
};

type OauthFailure = {
  ok: false;
  status: 400 | 401;
  body: OauthErrorBody;
};

type TokenSuccess = {
  ok: true;
  status: 200;
  body: TokenSuccessBody;
};

export type TokenResult = TokenSuccess | OauthFailure;

export type RegisterResult
  = | {
    ok: true;
    status: 201;
    body: {
      client_id: string;
      client_name: string;
      redirect_uris: string[];
      grant_types: ['authorization_code', 'refresh_token'];
      response_types: ['code'];
      token_endpoint_auth_method: 'none';
    };
  }
  | OauthFailure;

export type AuthorizationDecision
  = | { ok: true; redirect: string }
    | OauthFailure;

export const hashOpaqueSecret = (value: string) => {
  return createHash('sha256').update(value).digest('hex');
};

export const newOpaqueSecret = () => randomBytes(32).toString('base64url');

export const pkceS256 = (verifier: string) => {
  return createHash('sha256').update(verifier).digest('base64url');
};

export const originBase = (origin: string) => origin.replace(/\/$/, '');

export const mcpResourceUrl = (origin: string) => `${originBase(origin)}/api/mcp`;

export const protectedResourceMetadataPath = '/.well-known/oauth-protected-resource';

export const protectedResourceMetadata = (origin: string) => {
  const base = originBase(origin);
  return {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ['header']
  };
};

export const authorizationServerMetadata = (origin: string) => {
  const base = originBase(origin);
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none']
  };
};

export const mcpWwwAuthenticate = (origin: string) => {
  const base = originBase(origin);
  const metadata = `${base}${protectedResourceMetadataPath}/api/mcp`;
  return `Bearer realm="LiveMemory", resource_metadata="${metadata}"`;
};

export const readBearerToken = (authorization: string | undefined) => {
  const auth = (authorization ?? '').trim();
  const bearer = /^Bearer\s+(\S+)/i.exec(auth);
  return bearer?.[1]?.trim() ?? '';
};

const fail = (
  status: 400 | 401,
  error: OauthErrorBody['error'],
  errorDescription: string
): OauthFailure => ({
  ok: false,
  status,
  body: {
    error,
    error_description: errorDescription
  }
});

const isUuid = (value: string) => UUID_PATTERN.test(value);

const hasControlCharacter = (value: string) => {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) {
      return true;
    }
  }

  return false;
};

const hasBidiCharacter = (value: string) => {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (
      code === 0x200E
      || code === 0x200F
      || (code >= 0x202A && code <= 0x202E)
      || (code >= 0x2066 && code <= 0x2069)
    ) {
      return true;
    }
  }

  return false;
};

const stateRejection = (state: string) => {
  if (!state) {
    return null;
  }

  if (state.length > STATE_MAX || hasControlCharacter(state)) {
    return fail(400, 'invalid_request', 'The state parameter is not valid.');
  }

  return null;
};

export const authorizationRedirect = (
  redirectUri: string,
  params: Record<string, string>
) => {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
};

const stringList = (value: unknown) => {
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) {
    return null;
  }

  return value as string[];
};

export const registerOauthClient = async (
  store: OauthStore,
  input: {
    client_name?: unknown;
    redirect_uris?: unknown;
    grant_types?: unknown;
    response_types?: unknown;
    token_endpoint_auth_method?: unknown;
    client_secret?: unknown;
  }
): Promise<RegisterResult> => {
  if (input.client_secret !== undefined && input.client_secret !== null && input.client_secret !== '') {
    return fail(400, 'invalid_request', 'Public clients do not use a client secret.');
  }

  if (
    input.token_endpoint_auth_method !== undefined
    && input.token_endpoint_auth_method !== 'none'
  ) {
    return fail(400, 'invalid_request', 'Only public clients are supported.');
  }

  const grantTypes = input.grant_types === undefined
    ? ['authorization_code', 'refresh_token']
    : stringList(input.grant_types);
  if (
    !grantTypes
    || grantTypes.length === 0
    || grantTypes.some(grant => grant !== 'authorization_code' && grant !== 'refresh_token')
    || !grantTypes.includes('authorization_code')
  ) {
    return fail(400, 'invalid_request', 'Only authorization code and refresh grants are supported.');
  }

  const responseTypes = input.response_types === undefined
    ? ['code']
    : stringList(input.response_types);
  if (!responseTypes || responseTypes.length !== 1 || responseTypes[0] !== 'code') {
    return fail(400, 'invalid_request', 'Only the authorization code response type is supported.');
  }

  const rawClientName = typeof input.client_name === 'string' ? input.client_name : '';
  const clientName = rawClientName.trim();
  if (
    !clientName
    || clientName.length > CLIENT_NAME_MAX
    || hasControlCharacter(rawClientName)
    || hasBidiCharacter(rawClientName)
  ) {
    return fail(400, 'invalid_request', 'A client name is required.');
  }

  const redirectUris = stringList(input.redirect_uris);
  if (
    !redirectUris
    || redirectUris.length === 0
    || redirectUris.length > REDIRECT_URI_LIMIT
    || redirectUris.some(uri => !isAllowedRedirectUri(uri))
  ) {
    return fail(400, 'invalid_request', 'Redirect URLs must be https or loopback http://localhost or http://127.0.0.1.');
  }

  const clientId = await store.registerClient(clientName, redirectUris);
  return {
    ok: true,
    status: 201,
    body: {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'
    }
  };
};

export type AuthorizationRequest = {
  decision: 'allow' | 'deny';
  userId: string;
  clientId: string;
  redirectUri: string;
  responseType: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  resource: string;
  origin: string;
};

export const decideOauthAuthorization = async (
  store: OauthStore,
  input: AuthorizationRequest,
  now = new Date()
): Promise<AuthorizationDecision> => {
  if (!isUuid(input.userId) || !isUuid(input.clientId)) {
    return fail(400, 'invalid_request', 'This authorization request is not valid.');
  }

  if (!isAllowedRedirectUri(input.redirectUri)) {
    return fail(400, 'invalid_request', 'The redirect URL must be https or loopback http.');
  }

  const client = await store.findClientForRedirect(input.clientId, input.redirectUri);
  if (!client) {
    return fail(400, 'invalid_request', 'This client is not registered or the redirect URL does not match.');
  }

  if (input.responseType !== 'code' || input.codeChallengeMethod !== 'S256') {
    return fail(400, 'invalid_request', 'Only authorization code with PKCE S256 is supported.');
  }

  if (!CODE_CHALLENGE_PATTERN.test(input.codeChallenge)) {
    return fail(400, 'invalid_request', 'Only authorization code with PKCE S256 is supported.');
  }

  if (input.resource && input.resource !== mcpResourceUrl(input.origin)) {
    return fail(400, 'invalid_request', 'This client asked for a different resource.');
  }

  const rejectedState = stateRejection(input.state);
  if (rejectedState) {
    return rejectedState;
  }

  const state = input.state;
  if (input.decision === 'deny') {
    return {
      ok: true,
      redirect: authorizationRedirect(input.redirectUri, {
        error: 'access_denied',
        state
      })
    };
  }

  const code = newOpaqueSecret();
  const expiresAt = new Date(now.getTime() + AUTHORIZATION_CODE_TTL_MS).toISOString();
  await store.issueAuthorizationCode({
    userId: input.userId,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    codeHash: hashOpaqueSecret(code),
    expiresAt
  });

  return {
    ok: true,
    redirect: authorizationRedirect(input.redirectUri, {
      code,
      state
    })
  };
};

const rejectClientSecret = (clientSecret: unknown): OauthFailure | null => {
  if (clientSecret !== undefined && clientSecret !== null && clientSecret !== '') {
    return fail(400, 'invalid_request', 'Public clients do not use a client secret.');
  }

  return null;
};

const tokenFields = (input: Record<string, unknown>) => ({
  grantType: typeof input.grant_type === 'string' ? input.grant_type : '',
  code: typeof input.code === 'string' ? input.code : '',
  redirectUri: typeof input.redirect_uri === 'string' ? input.redirect_uri : '',
  clientId: typeof input.client_id === 'string' ? input.client_id : '',
  codeVerifier: typeof input.code_verifier === 'string' ? input.code_verifier : '',
  refreshToken: typeof input.refresh_token === 'string' ? input.refresh_token : '',
  clientSecret: input.client_secret
});

export const exchangeOauthToken = async (
  store: OauthStore,
  input: Record<string, unknown>,
  now = new Date()
): Promise<TokenResult> => {
  const fields = tokenFields(input);
  const secretError = rejectClientSecret(fields.clientSecret);
  if (secretError) {
    return secretError;
  }

  if (fields.grantType === 'refresh_token') {
    return exchangeRefreshToken(store, fields, now);
  }

  if (fields.grantType !== 'authorization_code') {
    return fail(400, 'invalid_request', 'Only authorization code and refresh grants are supported.');
  }

  if (!fields.code || !fields.redirectUri || !isUuid(fields.clientId) || !fields.codeVerifier) {
    return fail(400, 'invalid_request', 'The authorization code request is incomplete.');
  }

  if (!CODE_VERIFIER_PATTERN.test(fields.codeVerifier) || !isAllowedRedirectUri(fields.redirectUri)) {
    return fail(400, 'invalid_grant', 'The authorization code could not be redeemed.');
  }

  const accessToken = newOpaqueSecret();
  const nextRefresh = newOpaqueSecret();
  const accessExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS).toISOString();
  const redeemed = await store.redeemAuthorizationCode({
    codeHash: hashOpaqueSecret(fields.code),
    clientId: fields.clientId,
    redirectUri: fields.redirectUri,
    codeChallenge: pkceS256(fields.codeVerifier),
    accessTokenHash: hashOpaqueSecret(accessToken),
    accessExpiresAt,
    refreshTokenHash: hashOpaqueSecret(nextRefresh)
  });

  if (redeemed.status !== 'ok' || !redeemed.grantId || !redeemed.userId) {
    return fail(400, 'invalid_grant', 'The authorization code could not be redeemed.');
  }

  return {
    ok: true,
    status: 200,
    body: {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: nextRefresh
    }
  };
};

const exchangeRefreshToken = async (
  store: OauthStore,
  fields: ReturnType<typeof tokenFields>,
  now: Date
): Promise<TokenResult> => {
  if (!fields.refreshToken || !isUuid(fields.clientId)) {
    return fail(401, 'invalid_grant', 'The refresh token is not valid.');
  }

  const accessToken = newOpaqueSecret();
  const nextRefresh = newOpaqueSecret();
  const accessExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS).toISOString();
  const userId = await store.rotateRefreshToken({
    refreshTokenHash: hashOpaqueSecret(fields.refreshToken),
    clientId: fields.clientId,
    accessTokenHash: hashOpaqueSecret(accessToken),
    accessExpiresAt,
    nextRefreshTokenHash: hashOpaqueSecret(nextRefresh)
  });
  if (!userId) {
    return fail(401, 'invalid_grant', 'The refresh token is not valid.');
  }

  return {
    ok: true,
    status: 200,
    body: {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: nextRefresh
    }
  };
};
