import {
  createError,
  defineEventHandler,
  getMethod,
  getRequestHeader,
  getRequestHeaders,
  getRequestURL,
  readRawBody,
  send,
  setResponseHeader,
  setResponseStatus
} from 'h3';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { exchangePersonalKey } from '../../utils/personal-key-exchange';
import { MCP_KEY_HEADER, readPersonalKeyFromHeaders } from '../../utils/mcp-auth';
import { readMcpSupabaseEnv } from '../../utils/mcp-runtime';
import { createUserScopedClient } from '../../utils/mcp-user-client';
import { createLiveMemoryMcpServer } from '../../utils/mcp-server';

const MCP_ALLOWED_HEADERS = [
  'content-type',
  'authorization',
  MCP_KEY_HEADER,
  'mcp-session-id',
  'mcp-protocol-version',
  'accept',
  'last-event-id'
].join(', ');

const applyCors = (event: Parameters<typeof setResponseHeader>[0]) => {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*');
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  setResponseHeader(event, 'Access-Control-Allow-Headers', MCP_ALLOWED_HEADERS);
  setResponseHeader(event, 'Access-Control-Expose-Headers', 'mcp-session-id, mcp-protocol-version');
};

const headersToFetch = (headers: Record<string, string | undefined>) => {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value) {
      result.set(name, value);
    }
  }

  return result;
};

const writeWebResponse = async (
  event: Parameters<typeof setResponseStatus>[0],
  response: Response
) => {
  setResponseStatus(event, response.status, response.statusText);
  response.headers.forEach((value, name) => {
    setResponseHeader(event, name, value);
  });
  applyCors(event);
  const body = await response.text();
  return send(event, body);
};

export default defineEventHandler(async (event) => {
  applyCors(event);
  const method = getMethod(event).toUpperCase();

  if (method === 'OPTIONS') {
    setResponseStatus(event, 204);
    return send(event, '');
  }

  if (method !== 'POST') {
    setResponseStatus(event, 405, 'Method Not Allowed');
    setResponseHeader(event, 'Allow', 'POST, OPTIONS');
    return send(event, JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.'
      },
      id: null
    }));
  }

  const personalKey = readPersonalKeyFromHeaders(
    getRequestHeader(event, 'authorization'),
    getRequestHeader(event, MCP_KEY_HEADER)
  );
  if (!personalKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid personal key.'
    });
  }

  const env = readMcpSupabaseEnv(event);
  const session = await exchangePersonalKey(personalKey, env);
  const client = createUserScopedClient(env, session.access_token);

  const raw = await readRawBody(event);
  let parsedBody: unknown;
  try {
    const text = typeof raw === 'string'
      ? raw
      : raw
        ? new TextDecoder().decode(raw)
        : '';
    parsedBody = text ? JSON.parse(text) : undefined;
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Parse error: Invalid JSON'
    });
  }

  const request = new Request(getRequestURL(event), {
    method,
    headers: headersToFetch(getRequestHeaders(event) as Record<string, string | undefined>)
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  const server = createLiveMemoryMcpServer(client);
  await server.connect(transport);

  try {
    const response = await transport.handleRequest(request, { parsedBody });
    return await writeWebResponse(event, response);
  } finally {
    await transport.close();
    await server.close();
  }
});
