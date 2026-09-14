import { createError, getRequestHeader, type H3Event } from 'h3';
import { serverSupabaseSession, serverSupabaseUser } from '#supabase/server';
import { readMcpSupabaseEnv } from './mcp-runtime';

export type AgentSession = {
  accessToken: string;
  userId: string;
  env: ReturnType<typeof readMcpSupabaseEnv>;
};

const userFromBearer = async (
  accessToken: string,
  env: ReturnType<typeof readMcpSupabaseEnv>
): Promise<string | null> => {
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: env.anonKey, Authorization: `Bearer ${accessToken}` }
  });
  const user = await response.json().catch(() => null) as { id?: string } | null;
  if (!response.ok || !user?.id) return null;
  return user.id;
};

const userFromCookies = async (event: H3Event): Promise<{ userId: string; accessToken: string } | null> => {
  const claims = await serverSupabaseUser(event).catch(() => null);
  const session = await serverSupabaseSession(event).catch(() => null);
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;
  const accessToken = typeof session?.access_token === 'string' ? session.access_token : null;
  if (!userId || !accessToken) return null;
  return { userId, accessToken };
};

export const requireAgentSession = async (event: H3Event): Promise<AgentSession> => {
  const env = readMcpSupabaseEnv(event);
  const authorization = getRequestHeader(event, 'authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  if (match?.[1]) {
    const userId = await userFromBearer(match[1], env);
    if (userId) {
      return { accessToken: match[1], userId, env };
    }
  }

  const fromCookies = await userFromCookies(event);
  if (fromCookies) {
    return { accessToken: fromCookies.accessToken, userId: fromCookies.userId, env };
  }

  throw createError({ statusCode: 401, statusMessage: 'Authentication is required.' });
};
