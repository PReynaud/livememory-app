import {
  createError, defineEventHandler, getMethod, getRequestHeader, getRequestHeaders,
  getRequestURL, readRawBody, send, setResponseHeader, setResponseStatus
} from 'h3';
import { useRuntimeConfig } from '#imports';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyAgentCapability } from '../../utils/agent-capability';
import { createEmbeddedMcpServer } from '../../utils/embedded-mcp-server';
import { readMcpSupabaseEnv } from '../../utils/mcp-runtime';
import { createUserScopedClient } from '../../utils/mcp-user-client';
import { mintUserSession } from '../../utils/personal-key-exchange';
import { readConfirmedProposal } from '../../utils/agent-proposals';
import type { AgentSession } from '../../utils/agent-session';
import { getAgentConnection } from '../../utils/agent-connections';

const toHeaders = (values: Record<string, string | undefined>) => {
  const headers = new Headers();
  Object.entries(values).forEach(([key, value]) => value && headers.set(key, value));
  return headers;
};

export default defineEventHandler(async (event) => {
  if (getMethod(event).toUpperCase() !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed.' });
  }
  const config = useRuntimeConfig(event);
  const capabilitySecret = String(config.agentCapabilitySecret || '');
  if (!capabilitySecret) throw createError({ statusCode: 500, statusMessage: 'Agent capability security is not configured.' });
  const token = getRequestHeader(event, 'x-livememory-agent-capability') ?? '';
  const capability = verifyAgentCapability(token, capabilitySecret);
  if (!capability) throw createError({ statusCode: 401, statusMessage: 'Invalid agent capability.' });

  const env = readMcpSupabaseEnv(event);
  const session: AgentSession = { accessToken: '', userId: capability.userId, env };
  const connection = await getAgentConnection(session);
  if (!connection || connection.updated_at !== capability.connectionUpdatedAt) {
    throw createError({ statusCode: 401, statusMessage: 'Expired agent capability.' });
  }
  const proposal = capability.scope === 'write' && capability.proposalId
    ? await readConfirmedProposal(session, capability.proposalId)
    : undefined;
  if (capability.scope === 'write' && !proposal) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid confirmed proposal.' });
  }
  const accessToken = await mintUserSession(capability.userId, env);
  const raw = await readRawBody(event);
  const text = typeof raw === 'string' ? raw : raw ? new TextDecoder().decode(raw) : '';
  let parsedBody: unknown;
  try {
    parsedBody = text ? JSON.parse(text) : undefined;
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Parse error: Invalid JSON' });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  const server = createEmbeddedMcpServer(
    createUserScopedClient(env, accessToken),
    capability.scope,
    proposal?.operations
  );
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(new Request(getRequestURL(event), {
      method: 'POST',
      headers: toHeaders(getRequestHeaders(event) as Record<string, string | undefined>)
    }), { parsedBody });
    setResponseStatus(event, response.status, response.statusText);
    response.headers.forEach((value, name) => setResponseHeader(event, name, value));
    return send(event, await response.text());
  } finally {
    await transport.close();
    await server.close();
  }
});
