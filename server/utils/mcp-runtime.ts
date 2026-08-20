import type { H3Event } from 'h3';
import { useRuntimeConfig } from '#imports';
import type { PersonalKeyExchangeEnv } from './personal-key-exchange';

export const readMcpSupabaseEnv = (event: H3Event): PersonalKeyExchangeEnv => {
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

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey
  };
};
