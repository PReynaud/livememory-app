import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from '../local-supabase';
import type { E2EAccount } from './e2e-account';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

export const signInRest = async (account: Pick<E2EAccount, 'email' | 'password'>) => {
  const supabaseUrl = (process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || LOCAL_SUPABASE_ANON_KEY;
  const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: account.email, password: account.password })
  });

  if (!sessionResponse.ok) {
    throw new Error(`Failed to sign in E2E account: ${await sessionResponse.text()}`);
  }

  const session = await sessionResponse.json() as { access_token: string };
  return { supabaseUrl, headers: restHeaders(session.access_token, anonKey) };
};

export const createOwnedEventRest = async (
  account: Pick<E2EAccount, 'email' | 'password'>,
  input: { kind?: 'single_night' | 'festival'; name: string; start: string; end?: string; place: string }
) => {
  const session = await signInRest(account);
  const response = await fetch(`${session.supabaseUrl}/rest/v1/events`, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({
      kind: input.kind ?? 'single_night',
      name: input.name,
      start_date: input.start,
      end_date: input.end ?? input.start,
      place: input.place
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create event: ${await response.text()}`);
  }

  const rows = await response.json() as { id: string }[];
  const id = rows[0]?.id;
  if (!id) {
    throw new Error('Failed to create event');
  }

  return { id, path: `/e/${id}` };
};
