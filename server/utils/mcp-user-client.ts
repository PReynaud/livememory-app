import { createClient } from '@supabase/supabase-js';
import type { McpSupabaseEnv } from './personal-key-exchange';

export const createUserScopedClient = (
  env: McpSupabaseEnv,
  accessToken: string
) => {
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
};
