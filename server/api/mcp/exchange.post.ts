import { createError, defineEventHandler, readBody } from 'h3';
import { exchangePersonalKey } from '../../utils/personal-key-exchange';
import { readMcpSupabaseEnv } from '../../utils/mcp-runtime';

type ExchangeBody = {
  key?: unknown;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<ExchangeBody>(event).catch(() => ({} as ExchangeBody));
  const key = typeof body?.key === 'string' ? body.key : '';

  if (!key.trim()) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid personal key.'
    });
  }

  return await exchangePersonalKey(key, readMcpSupabaseEnv(event));
});
