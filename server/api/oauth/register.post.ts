import { createError, defineEventHandler, readBody } from 'h3';
import { registerOauthClient } from '../../utils/oauth';
import { createSupabaseOauthStore } from '../../utils/oauth-db';
import { sendOauthJson } from '../../utils/oauth-http';
import { assertMcpSupabaseEnv } from '../../utils/personal-key-exchange';
import { readMcpSupabaseEnv } from '../../utils/mcp-runtime';

export default defineEventHandler(async (event) => {
  const env = readMcpSupabaseEnv(event);
  assertMcpSupabaseEnv(env);
  const body = await readBody<Record<string, unknown>>(event).catch(() => ({}));

  try {
    const result = await registerOauthClient(createSupabaseOauthStore(env), body ?? {});
    return sendOauthJson(event, result.status, result.body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('invalid redirect uri')
      || message.includes('invalid client name')
      || message.includes('22023')
    ) {
      return sendOauthJson(event, 400, {
        error: 'invalid_request',
        error_description: 'The client registration is not valid.'
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Could not register the client.'
    });
  }
});
