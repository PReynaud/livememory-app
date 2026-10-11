import { createError, defineEventHandler, getRequestHeader, readRawBody } from 'h3';
import { exchangeOauthToken } from '../../utils/oauth';
import { createSupabaseOauthStore } from '../../utils/oauth-db';
import { sendOauthJson } from '../../utils/oauth-http';
import { assertMcpSupabaseEnv } from '../../utils/personal-key-exchange';
import { readMcpSupabaseEnv } from '../../utils/mcp-runtime';

const readTokenBody = (raw: string, contentType: string): Record<string, unknown> => {
  if (contentType.toLowerCase().includes('application/json')) {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  }

  return Object.fromEntries(new URLSearchParams(raw).entries());
};

export default defineEventHandler(async (event) => {
  const env = readMcpSupabaseEnv(event);
  assertMcpSupabaseEnv(env);
  const raw = await readRawBody(event);
  const text = typeof raw === 'string'
    ? raw
    : raw
      ? new TextDecoder().decode(raw)
      : '';
  let body: Record<string, unknown>;
  try {
    body = text
      ? readTokenBody(text, getRequestHeader(event, 'content-type') ?? '')
      : {};
  } catch {
    return sendOauthJson(event, 400, {
      error: 'invalid_request',
      error_description: 'The token request could not be read.'
    });
  }

  try {
    const result = await exchangeOauthToken(createSupabaseOauthStore(env), body);
    return sendOauthJson(event, result.status, result.body);
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Could not issue a token.'
    });
  }
});
