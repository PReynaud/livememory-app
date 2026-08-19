import { test, expect } from '@playwright/test';
import { createE2EAccountForTest, deleteE2EAccountForTest } from './helpers/e2e-account';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

test('insert RLS rejects out-of-range dates and a Place that is not the Event Place', async ({ page: _page }, testInfo) => {
  const account = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-${testInfo.retry}`);

  try {
    const supabaseUrl = (process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/$/, '');
    const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || LOCAL_SUPABASE_ANON_KEY;

    const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password
      })
    });
    expect(sessionResponse.ok).toBe(true);
    const session = await sessionResponse.json() as { access_token: string };

    const headers = restHeaders(session.access_token, anonKey);

    const eventResponse = await fetch(`${supabaseUrl}/rest/v1/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        kind: 'festival',
        name: 'Rock Week',
        start_date: '2026-08-20',
        end_date: '2026-08-22',
        place: 'Paris'
      })
    });
    expect(eventResponse.ok).toBe(true);
    const events = await eventResponse.json() as { id: string }[];
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    const outOfRange = await fetch(`${supabaseUrl}/rest/v1/concerts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event_id: eventId,
        artist: 'Justice',
        date: '2026-08-19',
        place: 'Paris'
      })
    });
    expect(outOfRange.ok).toBe(false);

    const wrongPlace = await fetch(`${supabaseUrl}/rest/v1/concerts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event_id: eventId,
        artist: 'Justice',
        date: '2026-08-21',
        place: 'Berlin'
      })
    });
    expect(wrongPlace.ok).toBe(false);

    const valid = await fetch(`${supabaseUrl}/rest/v1/concerts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event_id: eventId,
        artist: 'Justice',
        date: '2026-08-21',
        place: 'Paris'
      })
    });
    expect(valid.ok).toBe(true);
    const concerts = await valid.json() as { id: string; date: string; place: string }[];
    expect(concerts[0]?.date).toBe('2026-08-21');
    expect(concerts[0]?.place).toBe('Paris');

    const listed = await fetch(`${supabaseUrl}/rest/v1/concerts?event_id=eq.${eventId}`, {
      headers
    });
    expect(listed.ok).toBe(true);
    const rows = await listed.json() as unknown[];
    expect(rows).toHaveLength(1);
  } finally {
    await deleteE2EAccountForTest(account.userId);
  }
});
