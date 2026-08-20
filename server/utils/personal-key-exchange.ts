import { createError } from 'h3';
import { hashPersonalKey } from '#shared/domain/personal-keys';

export type PersonalKeyExchangeEnv = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

export type PersonalKeyExchangeSuccess = {
  access_token: string;
  token_type: 'bearer';
  user_id: string;
  username: string | null;
};

const INVALID_KEY = 'Invalid personal key.';

const jsonHeaders = (apiKey: string, accessToken = apiKey) => ({
  'apikey': apiKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
});

const rejectInvalid = (): never => {
  throw createError({
    statusCode: 401,
    statusMessage: INVALID_KEY
  });
};

const readJson = async <T>(response: Response, fallback: string): Promise<T> => {
  const text = await response.text();
  if (!response.ok) {
    throw createError({
      statusCode: response.status >= 400 && response.status < 600 ? response.status : 500,
      statusMessage: text || fallback
    });
  }

  if (!text) {
    return null as T;
  }

  return JSON.parse(text) as T;
};

const lookupUserId = async (
  keyHash: string,
  env: PersonalKeyExchangeEnv
): Promise<string | null> => {
  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/rpc/lookup_personal_key_user`,
    {
      method: 'POST',
      headers: jsonHeaders(env.serviceRoleKey),
      body: JSON.stringify({ key_hash: keyHash })
    }
  );

  const userId = await readJson<string | null>(response, 'Personal key lookup failed');
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
};

const mintUserSession = async (userId: string, env: PersonalKeyExchangeEnv): Promise<string> => {
  const userResponse = await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: jsonHeaders(env.serviceRoleKey)
  });
  const user = await readJson<{ email?: string }>(userResponse, 'Failed to load user for mint');
  if (!user.email) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mint user session'
    });
  }

  const linkResponse = await fetch(`${env.supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: jsonHeaders(env.serviceRoleKey),
    body: JSON.stringify({
      type: 'magiclink',
      email: user.email
    })
  });
  const link = await readJson<{
    hashed_token?: string;
    properties?: { hashed_token?: string };
  }>(linkResponse, 'Failed to mint user session');

  const tokenHash = link.properties?.hashed_token ?? link.hashed_token;
  if (!tokenHash) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mint user session'
    });
  }

  const verifyResponse = await fetch(`${env.supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'apikey': env.anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'magiclink',
      token_hash: tokenHash
    })
  });
  const session = await readJson<{ access_token?: string }>(
    verifyResponse,
    'Failed to mint user session'
  );

  if (!session.access_token) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mint user session'
    });
  }

  return session.access_token;
};

const readOwnUsername = async (
  accessToken: string,
  userId: string,
  env: PersonalKeyExchangeEnv
): Promise<string | null> => {
  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=username`,
    {
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  const rows = await readJson<Array<{ username?: string }>>(
    response,
    'Failed to read profile'
  );
  const username = Array.isArray(rows) ? rows[0]?.username : undefined;
  return typeof username === 'string' && username.length > 0 ? username : null;
};

export const exchangePersonalKey = async (
  plaintext: string,
  env: PersonalKeyExchangeEnv
): Promise<PersonalKeyExchangeSuccess> => {
  const key = plaintext.trim();
  if (!key) {
    return rejectInvalid();
  }

  if (!env.supabaseUrl || !env.anonKey || !env.serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Personal key exchange is not configured'
    });
  }

  const keyHash = await hashPersonalKey(key);
  const userId = await lookupUserId(keyHash, env);
  if (!userId) {
    return rejectInvalid();
  }

  const accessToken = await mintUserSession(userId, env);
  const username = await readOwnUsername(accessToken, userId, env);

  return {
    access_token: accessToken,
    token_type: 'bearer',
    user_id: userId,
    username
  };
};
