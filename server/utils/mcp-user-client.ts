import { createClient } from '@supabase/supabase-js';
import type { PersonalKeyExchangeEnv } from './personal-key-exchange';

export const createUserScopedClient = (
  env: PersonalKeyExchangeEnv,
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
