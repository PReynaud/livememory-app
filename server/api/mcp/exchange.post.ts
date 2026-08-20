import { createError, defineEventHandler, readBody } from 'h3';
import { useRuntimeConfig } from '#imports';
import { exchangePersonalKey } from '../../utils/personal-key-exchange';

type ExchangeBody = {
  key?: unknown;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<ExchangeBody>(event).catch(() => ({} as ExchangeBody));
  const key = typeof body?.key === 'string' ? body.key : '';

  const config = useRuntimeConfig(event);
  const publicConfig = config.public as {
    supabase?: { url?: string; key?: string };
  };

  const supabaseUrl = (
    publicConfig.supabase?.url
    || process.env.NUXT_PUBLIC_SUPABASE_URL
    || ''
  ).replace(/\/$/, '');
  const anonKey = publicConfig.supabase?.key || process.env.NUXT_PUBLIC_SUPABASE_KEY || '';
  const serviceRoleKey = (
    (config.supabaseServiceRoleKey as string | undefined)
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY
    || ''
  );

  if (!key.trim()) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid personal key.'
    });
  }

  return await exchangePersonalKey(key, {
    supabaseUrl,
    anonKey,
    serviceRoleKey
  });
});
