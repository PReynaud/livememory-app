import { createError } from 'h3';

export type McpSupabaseEnv = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const jsonHeaders = (apiKey: string, accessToken = apiKey) => ({
  'apikey': apiKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
});

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

export const MCP_AUTH_NOT_CONFIGURED
  = 'MCP authorization is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.';

export const assertMcpSupabaseEnv = (env: McpSupabaseEnv) => {
  if (!env.supabaseUrl || !env.anonKey || !env.serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: MCP_AUTH_NOT_CONFIGURED
    });
  }
};

export const mintUserSession = async (userId: string, env: McpSupabaseEnv): Promise<string> => {
  assertMcpSupabaseEnv(env);

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
