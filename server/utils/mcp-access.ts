import { hashOpaqueSecret, mcpWwwAuthenticate, readBearerToken } from './oauth';

export type McpAccess
  = | { ok: true; userId: string }
    | { ok: false; status: 401; wwwAuthenticate: string };

export const resolveMcpAccess = async (
  authorization: string | undefined,
  origin: string,
  lookupUserId: (tokenHash: string) => Promise<string | null>
): Promise<McpAccess> => {
  const wwwAuthenticate = mcpWwwAuthenticate(origin);
  const token = readBearerToken(authorization);
  if (!token) {
    return { ok: false, status: 401, wwwAuthenticate };
  }

  const userId = await lookupUserId(hashOpaqueSecret(token));
  if (!userId) {
    return { ok: false, status: 401, wwwAuthenticate };
  }

  return { ok: true, userId };
};
