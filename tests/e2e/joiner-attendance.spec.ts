import { test, expect } from '@playwright/test';
import { createE2EAccountForTest, deleteE2EAccountForTest } from './helpers/e2e-account';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';
import { concertNotesRest } from './helpers/concert-rest';
import type { E2EAccount } from './helpers/e2e-account';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

const parisToday = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

const addUtcDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const signInRest = async (account: Pick<E2EAccount, 'email' | 'password'>) => {
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
  expect(sessionResponse.ok).toBe(true);
  const session = await sessionResponse.json() as { access_token: string };
  return { supabaseUrl, headers: restHeaders(session.access_token, anonKey) };
};

const postJson = async <T>(url: string, headers: ReturnType<typeof restHeaders>, body: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${await response.text()}`);
  }
  return await response.json() as T;
};

const signInOnPage = async (
  page: import('@playwright/test').Page,
  account: Pick<E2EAccount, 'email' | 'password'>
) => {
  await waitForNuxtHydration(page);
  const form = page.locator('form').first();
  await form.getByLabel('Email').fill(account.email);
  await form.locator('input[name="password"]').fill(account.password);
  await form.getByRole('button', { name: 'Sign in' }).click();
};

const chipFor = (page: import('@playwright/test').Page, artist: string) => {
  return page
    .getByText(artist, { exact: true })
    .locator('xpath=following::button[contains(@aria-label,"Mark as")][1]');
};

test('joiner sets, changes, and clears only their Attendance and can attend this night', async ({
  page
}, testInfo) => {
  const owner = await createE2EAccountForTest(`j2a-own-${testInfo.workerIndex}-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`j2a-join-${testInfo.workerIndex}-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const start = addUtcDays(parisToday(), 8);
    const events = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/events?select=id`, ownerSession.headers, {
      kind: 'single_night',
      name: 'Joiner Night',
      start_date: start,
      end_date: start,
      place: 'Paris'
    });
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    const justice = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/concerts?select=id`, ownerSession.headers, {
      event_id: eventId,
      artist: 'Justice',
      date: start,
      place: 'Paris'
    });
    const fontaines = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/concerts?select=id`, ownerSession.headers, {
      event_id: eventId,
      artist: 'Fontaines D.C.',
      date: start,
      place: 'Paris'
    });
    const justiceId = justice[0]?.id;
    const fontainesId = fontaines[0]?.id;
    expect(justiceId).toBeTruthy();
    expect(fontainesId).toBeTruthy();

    const notesPatch = await fetch(concertNotesRest(ownerSession.supabaseUrl, `concert_id=eq.${justiceId}`), {
      method: 'PATCH',
      headers: ownerSession.headers,
      body: JSON.stringify({ notes: 'Back of the room.' })
    });
    expect(notesPatch.ok).toBe(true);

    await postJson(`${ownerSession.supabaseUrl}/rest/v1/attendance`, ownerSession.headers, {
      concert_id: justiceId,
      status: 'going'
    });

    await page.goto('/login');
    await signInOnPage(page, joiner);
    await expect(page).toHaveURL(/\/home/);

    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Joiner Night' })).toBeVisible();
    await expect(page.getByText('Justice')).toBeVisible();
    await expect(page.getByText('Fontaines D.C.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit event' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add to this night' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Edit Justice` })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete event' })).toHaveCount(0);
    await expect(page.getByText('Back of the room.')).toHaveCount(0);
    await expect(page.getByLabel('Notes')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Leave Event' })).toHaveCount(0);

    const justiceChip = chipFor(page, 'Justice');
    const fontainesChip = chipFor(page, 'Fontaines D.C.');
    await expect(justiceChip).toBeVisible();
    await expect(justiceChip).toHaveAttribute('aria-pressed', 'false');
    await expect(fontainesChip).toHaveAttribute('aria-pressed', 'false');

    await justiceChip.click();
    await expect(justiceChip).toHaveAttribute('aria-pressed', 'true');
    await expect(justiceChip).toHaveText('Going');
    await expect(fontainesChip).toHaveAttribute('aria-pressed', 'false');

    const joinerSession = await signInRest(joiner);
    const joinerRows = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/attendance?select=concert_id,status,user_id`,
      { headers: joinerSession.headers }
    );
    expect(joinerRows.ok).toBe(true);
    expect(await joinerRows.json()).toEqual([
      { concert_id: justiceId, status: 'going', user_id: joiner.userId }
    ]);

    const ownerRows = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/attendance?select=concert_id,status,user_id`,
      { headers: ownerSession.headers }
    );
    expect(ownerRows.ok).toBe(true);
    expect(await ownerRows.json()).toEqual([
      { concert_id: justiceId, status: 'going', user_id: owner.userId }
    ]);

    await page.getByRole('button', { name: 'Attend this night' }).click();
    await expect(chipFor(page, 'Justice')).toHaveAttribute('aria-pressed', 'true');
    await expect(chipFor(page, 'Fontaines D.C.')).toHaveAttribute('aria-pressed', 'true');
    await expect(chipFor(page, 'Fontaines D.C.')).toHaveText('Going');

    await chipFor(page, 'Justice').click();
    await expect(chipFor(page, 'Justice')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Justice')).toBeVisible();
    await expect(chipFor(page, 'Fontaines D.C.')).toHaveAttribute('aria-pressed', 'true');

    const afterClear = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/attendance?select=concert_id,status,user_id`,
      { headers: joinerSession.headers }
    );
    expect(await afterClear.json()).toEqual([
      { concert_id: fontainesId, status: 'going', user_id: joiner.userId }
    ]);
    const ownerStill = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/attendance?select=concert_id,user_id`,
      { headers: ownerSession.headers }
    );
    expect(await ownerStill.json()).toEqual([
      { concert_id: justiceId, user_id: owner.userId }
    ]);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});

test('joiner domain and REST Bill writes are blocked', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`j2b-own-${testInfo.workerIndex}-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`j2b-join-${testInfo.workerIndex}-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const start = addUtcDays(parisToday(), 9);
    const events = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/events?select=id`, ownerSession.headers, {
      kind: 'festival',
      name: 'Joiner Fest',
      start_date: start,
      end_date: addUtcDays(start, 1),
      place: 'Lyon'
    });
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    const concerts = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/concerts?select=id`, ownerSession.headers, {
      event_id: eventId,
      artist: 'Justice',
      date: start,
      place: 'Lyon'
    });
    const concertId = concerts[0]?.id;
    expect(concertId).toBeTruthy();

    await page.goto('/login');
    await signInOnPage(page, joiner);
    await expect(page).toHaveURL(/\/home/);
    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Joiner Fest' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Attend this night' })).toHaveCount(0);
    await expect(chipFor(page, 'Justice')).toBeVisible();

    const joinerSession = await signInRest(joiner);

    const addConcert = await fetch(`${joinerSession.supabaseUrl}/rest/v1/concerts`, {
      method: 'POST',
      headers: joinerSession.headers,
      body: JSON.stringify({
        event_id: eventId,
        artist: 'Aphex Twin',
        date: start,
        place: 'Lyon'
      })
    });
    expect(addConcert.ok).toBe(false);

    const editConcert = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}&select=id,artist`,
      {
        method: 'PATCH',
        headers: joinerSession.headers,
        body: JSON.stringify({ artist: 'Stolen' })
      }
    );
    expect(editConcert.ok).toBe(true);
    expect(await editConcert.json()).toEqual([]);

    const updateEvent = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/events?id=eq.${eventId}&select=id,name`,
      {
        method: 'PATCH',
        headers: joinerSession.headers,
        body: JSON.stringify({ name: 'Stolen Fest' })
      }
    );
    expect(updateEvent.ok).toBe(true);
    expect(await updateEvent.json()).toEqual([]);

    const deleteConcert = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}`,
      {
        method: 'DELETE',
        headers: {
          ...joinerSession.headers,
          Prefer: 'return=minimal'
        }
      }
    );
    expect(deleteConcert.ok).toBe(true);

    const stillThere = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}&select=id,artist`,
      { headers: ownerSession.headers }
    );
    expect(stillThere.ok).toBe(true);
    expect(await stillThere.json()).toEqual([{ id: concertId, artist: 'Justice' }]);

    const ownerEvent = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/events?id=eq.${eventId}&select=name`,
      { headers: ownerSession.headers }
    );
    expect(await ownerEvent.json()).toEqual([{ name: 'Joiner Fest' }]);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});
