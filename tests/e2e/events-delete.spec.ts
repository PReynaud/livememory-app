import { test, expect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './fixtures/auth.fixture';
import { createNightFromAddSheet } from './helpers/add-concert-sheet';
import { createOwnedEventRest } from './helpers/owned-event-rest';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { concertNotesRest, concertsRest } from './helpers/concert-rest';
import { createE2EAccountForTest, deleteE2EAccountForTest } from './helpers/e2e-account';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
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

const createEmptyNight = async (
  page: import('@playwright/test').Page,
  account: { email: string; password: string },
  input: { name: string; date: string; place: string }
) => {
  const created = await createOwnedEventRest(account, {
    name: input.name,
    start: input.date,
    place: input.place
  });
  await page.goto(created.path);
  await waitForNuxtHydration(page);
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  return created.path;
};

const createNightWithConcert = async (
  page: import('@playwright/test').Page,
  input: { name: string; date: string; place: string; artist: string }
) => {
  return createNightFromAddSheet(page, input);
};

authTest('owner deletes an empty Event immediately with no Concert warning', async ({ authenticatedPage, account }) => {
  const eventPath = await createEmptyNight(authenticatedPage, account, {
    name: 'Empty Night',
    date: '2026-08-12',
    place: 'Lyon'
  });

  await authenticatedPage.getByRole('button', { name: 'Edit event' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await authExpect(sheet).toBeVisible();
  await authExpect(sheet.getByText('This Event and all its Concerts will be deleted.')).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Delete', exact: true }).click();
  await authExpect(sheet).toHaveCount(0);
  await authExpect(authenticatedPage).toHaveURL(/\/concerts/);
  await authExpect(authenticatedPage.getByText('Event deleted.', { exact: true })).toBeVisible();
  await authExpect(authenticatedPage.getByRole('link', { name: /Empty Night/ })).toHaveCount(0);

  await authenticatedPage.goto(eventPath);
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Event not found.' })).toBeVisible();
  await authExpect(authenticatedPage.getByText('Empty Night')).toHaveCount(0);
});

authTest('owner must confirm deleting a non-empty Event', async ({ authenticatedPage }) => {
  const eventPath = await createNightWithConcert(authenticatedPage, {
    name: 'Club Night',
    date: '2026-08-18',
    place: 'Berlin',
    artist: 'Justice'
  });

  await authenticatedPage.getByRole('button', { name: 'Edit event' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Delete', exact: true }).click();
  await authExpect(sheet.getByText('This Event and all its Concerts will be deleted.')).toBeVisible();
  await authExpect(sheet.getByText(/joiner/i)).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await authExpect(sheet.getByText('This Event and all its Concerts will be deleted.')).toHaveCount(0);
  await authenticatedPage.keyboard.press('Escape');
  await authExpect(sheet).toHaveCount(0);
  await authExpect(authenticatedPage).toHaveURL(new RegExp(`${eventPath}$`));
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Club Night' })).toBeVisible();
  await authExpect(authenticatedPage.getByText('Justice')).toBeVisible();

  await authenticatedPage.getByRole('button', { name: 'Edit event' }).click();
  const confirmSheet = authenticatedPage.getByRole('dialog');
  await confirmSheet.getByRole('button', { name: 'Delete', exact: true }).click();
  await confirmSheet.getByRole('button', { name: 'Delete event' }).click();
  await authExpect(confirmSheet).toHaveCount(0);
  await authExpect(authenticatedPage).toHaveURL(/\/concerts/);
  await authExpect(authenticatedPage.getByRole('link', { name: /Club Night/ })).toHaveCount(0);

  await authenticatedPage.goto(eventPath);
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Event not found.' })).toBeVisible();
  await authExpect(authenticatedPage.getByText('Justice')).toHaveCount(0);
});

test('Event delete is owner-only and cascades Concerts, Attendance, and notes', async ({ page: _page }, testInfo) => {
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
        start_date: '2026-08-10',
        end_date: '2026-08-10',
        place: 'Berlin'
      })
    });
    expect(eventResponse.ok).toBe(true);
    const events = await eventResponse.json() as { id: string }[];
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    const concertResponse = await fetch(concertsRest(ownerSession.supabaseUrl), {
      method: 'POST',
      headers: ownerSession.headers,
      body: JSON.stringify({
        event_id: eventId,
        artist: 'Justice',
        date: '2026-08-10',
        place: 'Berlin'
      })
    });
    expect(concertResponse.ok).toBe(true);
    const concerts = await concertResponse.json() as { id: string }[];
    const concertId = concerts[0]?.id;
    expect(concertId).toBeTruthy();

    const notesResponse = await fetch(concertNotesRest(ownerSession.supabaseUrl, `concert_id=eq.${concertId}`), {
      method: 'PATCH',
      headers: ownerSession.headers,
      body: JSON.stringify({ notes: 'Back of the room.' })
    });
    expect(notesResponse.ok).toBe(true);

    const attendanceResponse = await fetch(`${ownerSession.supabaseUrl}/rest/v1/attendance`, {
      method: 'POST',
      headers: ownerSession.headers,
      body: JSON.stringify({
        concert_id: concertId,
        status: 'attended'
      })
    });
    expect(attendanceResponse.ok).toBe(true);

    const otherDelete = await fetch(`${otherSession.supabaseUrl}/rest/v1/events?id=eq.${eventId}`, {
      method: 'DELETE',
      headers: otherSession.headers
    });
    expect(otherDelete.ok).toBe(true);
    const otherDeleted = await otherDelete.json() as unknown[];
    expect(otherDeleted).toEqual([]);

    const stillOwned = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/events?id=eq.${eventId}&select=id,name`,
      { headers: ownerSession.headers }
    );
    const stillOwnedRows = await stillOwned.json() as { id: string }[];
    expect(stillOwnedRows).toHaveLength(1);

    const ownerDelete = await fetch(`${ownerSession.supabaseUrl}/rest/v1/events?id=eq.${eventId}`, {
      method: 'DELETE',
      headers: ownerSession.headers
    });
    expect(ownerDelete.ok).toBe(true);

    const eventsAfter = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/events?id=eq.${eventId}&select=id`,
      { headers: ownerSession.headers }
    );
    expect(await eventsAfter.json()).toEqual([]);

    const concertsAfter = await fetch(
      concertsRest(ownerSession.supabaseUrl, `id=eq.${concertId}`),
      { headers: ownerSession.headers }
    );
    expect(await concertsAfter.json()).toEqual([]);

    const notesAfter = await fetch(
      concertNotesRest(ownerSession.supabaseUrl, `concert_id=eq.${concertId}`),
      { headers: ownerSession.headers }
    );
    expect(await notesAfter.json()).toEqual([]);

    const attendanceAfter = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/attendance?concert_id=eq.${concertId}&select=id`,
      { headers: ownerSession.headers }
    );
    expect(await attendanceAfter.json()).toEqual([]);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(other.userId);
  }
});
