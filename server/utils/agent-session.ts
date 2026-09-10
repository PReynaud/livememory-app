import { createError, getRequestHeader, type H3Event } from 'h3';
import { readMcpSupabaseEnv } from './mcp-runtime';

export type AgentSession = {
  accessToken: string;
  userId: string;
  env: ReturnType<typeof readMcpSupabaseEnv>;
};

export const requireAgentSession = async (event: H3Event): Promise<AgentSession> => {
  const authorization = getRequestHeader(event, 'authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication is required.' });
  }

  const env = readMcpSupabaseEnv(event);
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: env.anonKey, Authorization: `Bearer ${match[1]}` }
  });
  const user = await response.json().catch(() => null) as { id?: string } | null;
  if (!response.ok || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication is required.' });
  }

  return { accessToken: match[1], userId: user.id, env };
};
