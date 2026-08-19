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

const signIn = async (email: string, password: string) => {
  const supabaseUrl = (process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || LOCAL_SUPABASE_ANON_KEY;
  const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  expect(sessionResponse.ok).toBe(true);
  const session = await sessionResponse.json() as { access_token: string };
  return { supabaseUrl, headers: restHeaders(session.access_token, anonKey) };
};

test('notes SELECT and UPDATE are Event-owner only', async ({ page: _page }, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-owner-${testInfo.retry}`);
  const other = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-other-${testInfo.retry}`);

  try {
    const ownerSession = await signIn(owner.email, owner.password);
    const otherSession = await signIn(other.email, other.password);

    const eventResponse = await fetch(`${ownerSession.supabaseUrl}/rest/v1/events`, {
      method: 'POST',
      headers: ownerSession.headers,
      body: JSON.stringify({
        kind: 'single_night',
        name: 'Club Night',
        start_date: '2026-08-18',
        end_date: '2026-08-18',
        place: 'Berlin'
      })
    });
    expect(eventResponse.ok).toBe(true);
    const events = await eventResponse.json() as { id: string }[];
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    const concertResponse = await fetch(`${ownerSession.supabaseUrl}/rest/v1/concerts`, {
      method: 'POST',
      headers: ownerSession.headers,
      body: JSON.stringify({
        event_id: eventId,
        artist: 'Justice',
        date: '2026-08-18',
        place: 'Berlin'
      })
    });
    expect(concertResponse.ok).toBe(true);
    const concerts = await concertResponse.json() as { id: string }[];
    const concertId = concerts[0]?.id;
    expect(concertId).toBeTruthy();

    const notesResponse = await fetch(`${ownerSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}`, {
      method: 'PATCH',
      headers: ownerSession.headers,
      body: JSON.stringify({ notes: 'Back of the room.' })
    });
    expect(notesResponse.ok).toBe(true);
    const updated = await notesResponse.json() as { notes: string | null }[];
    expect(updated[0]?.notes).toBe('Back of the room.');

    const ownerRead = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}&select=notes`,
      { headers: ownerSession.headers }
    );
    expect(ownerRead.ok).toBe(true);
    const ownerRows = await ownerRead.json() as { notes: string | null }[];
    expect(ownerRows).toEqual([{ notes: 'Back of the room.' }]);

    const otherRead = await fetch(
      `${otherSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}&select=notes`,
      { headers: otherSession.headers }
    );
    expect(otherRead.ok).toBe(true);
    const otherRows = await otherRead.json() as unknown[];
    expect(otherRows).toEqual([]);

    const otherPatch = await fetch(`${otherSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}`, {
      method: 'PATCH',
      headers: otherSession.headers,
      body: JSON.stringify({ notes: 'Stolen note' })
    });
    expect(otherPatch.ok).toBe(true);
    const otherPatched = await otherPatch.json() as unknown[];
    expect(otherPatched).toEqual([]);

    const afterTheft = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}&select=notes`,
      { headers: ownerSession.headers }
    );
    const afterTheftRows = await afterTheft.json() as { notes: string | null }[];
    expect(afterTheftRows[0]?.notes).toBe('Back of the room.');

    const otherDelete = await fetch(`${otherSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}`, {
      method: 'DELETE',
      headers: otherSession.headers
    });
    expect(otherDelete.ok).toBe(true);

    const stillThere = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}&select=id,notes`,
      { headers: ownerSession.headers }
    );
    const stillThereRows = await stillThere.json() as { id: string }[];
    expect(stillThereRows).toHaveLength(1);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(other.userId);
  }
});
