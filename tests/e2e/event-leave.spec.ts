import { test, expect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './fixtures/auth.fixture';
import { createE2EAccountForTest, deleteE2EAccountForTest } from './helpers/e2e-account';
import { concertNotesRest, concertsRest } from './helpers/concert-rest';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';
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

const membersUrl = (supabaseUrl: string, eventId: string) => {
  return `${supabaseUrl}/rest/v1/event_members?event_id=eq.${eventId}&select=user_id`;
};

const attendanceUrl = (supabaseUrl: string, concertId: string) => {
  return `${supabaseUrl}/rest/v1/attendance?concert_id=eq.${concertId}&select=user_id,status`;
};

test('joiner confirms Leave Event, drops membership and Attendance, and can rejoin', async ({
  page
}, testInfo) => {
  const owner = await createE2EAccountForTest(`leave-own-${testInfo.workerIndex}-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`leave-join-${testInfo.workerIndex}-${testInfo.retry}`);
  const other = await createE2EAccountForTest(`leave-other-${testInfo.workerIndex}-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const start = addUtcDays(parisToday(), 8);
    const events = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/events`, ownerSession.headers, {
      kind: 'single_night',
      name: 'Leave Night',
      start_date: start,
      end_date: start,
      place: 'Paris'
    });
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    const concerts = await postJson<{ id: string }[]>(concertsRest(ownerSession.supabaseUrl), ownerSession.headers, {
      event_id: eventId,
      artist: 'Justice',
      date: start,
      place: 'Paris'
    });
    const concertId = concerts[0]?.id;
    expect(concertId).toBeTruthy();

    const notesPatch = await fetch(concertNotesRest(ownerSession.supabaseUrl, `concert_id=eq.${concertId}`), {
      method: 'PATCH',
      headers: ownerSession.headers,
      body: JSON.stringify({ notes: 'Keep this note.' })
    });
    expect(notesPatch.ok).toBe(true);

    const otherSession = await signInRest(other);
    await postJson(`${otherSession.supabaseUrl}/rest/v1/event_members`, otherSession.headers, {
      event_id: eventId
    });
    await postJson(`${otherSession.supabaseUrl}/rest/v1/attendance`, otherSession.headers, {
      concert_id: concertId,
      status: 'going'
    });

    await page.goto('/login');
    await signInOnPage(page, joiner);
    await expect(page).toHaveURL(/\/home/);
    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Leave Night' })).toBeVisible();
    const joinerSession = await signInRest(joiner);
    await postJson(`${joinerSession.supabaseUrl}/rest/v1/attendance`, joinerSession.headers, {
      concert_id: concertId,
      status: 'going'
    });

    await page.reload();
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Leave Night' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave Event' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave Event' })).not.toHaveClass(/ring-2/);
    await expect(page.getByRole('button', { name: 'Edit event' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Leave Event' }).click();
    await expect(page.getByText('Leave this Event? It will leave your list. The bill stays for the owner.')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Leave this Event? It will leave your list. The bill stays for the owner.')).toHaveCount(0);
    const membersAfterCancel = await fetch(membersUrl(joinerSession.supabaseUrl, eventId!), {
      headers: joinerSession.headers
    });
    expect(await membersAfterCancel.json()).toEqual([{ user_id: joiner.userId }]);

    await page.getByRole('button', { name: 'Leave Event' }).click();
    await page.getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(page).toHaveURL(/\/concerts/);
    await waitForNuxtHydration(page);
    await expect(page.getByText('Leave Night')).toHaveCount(0);
    await expect(page.getByText('Justice')).toHaveCount(0);

    await page.goto('/home');
    await waitForNuxtHydration(page);
    await expect(page.getByText('Leave Night')).toHaveCount(0);

    const membersAfterLeave = await fetch(membersUrl(joinerSession.supabaseUrl, eventId!), {
      headers: joinerSession.headers
    });
    expect(await membersAfterLeave.json()).toEqual([]);

    const joinerAttendance = await fetch(attendanceUrl(joinerSession.supabaseUrl, concertId!), {
      headers: joinerSession.headers
    });
    expect(await joinerAttendance.json()).toEqual([]);

    const ownerConcerts = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}&select=id,artist`,
      { headers: ownerSession.headers }
    );
    expect(await ownerConcerts.json()).toEqual([{ id: concertId, artist: 'Justice' }]);

    const ownerNotes = await fetch(concertNotesRest(ownerSession.supabaseUrl, `concert_id=eq.${concertId}`), {
      headers: ownerSession.headers
    });
    expect(await ownerNotes.json()).toEqual([{ concert_id: concertId, notes: 'Keep this note.' }]);

    const otherMembers = await fetch(membersUrl(otherSession.supabaseUrl, eventId!), {
      headers: otherSession.headers
    });
    expect(await otherMembers.json()).toEqual([{ user_id: other.userId }]);

    const otherAttendance = await fetch(attendanceUrl(otherSession.supabaseUrl, concertId!), {
      headers: otherSession.headers
    });
    expect(await otherAttendance.json()).toEqual([{ user_id: other.userId, status: 'going' }]);

    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Leave Night' })).toBeVisible();
    await expect(page.getByText('Justice')).toBeVisible();
    const membersAfterRejoin = await fetch(membersUrl(joinerSession.supabaseUrl, eventId!), {
      headers: joinerSession.headers
    });
    expect(await membersAfterRejoin.json()).toEqual([{ user_id: joiner.userId }]);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
    await deleteE2EAccountForTest(other.userId);
  }
});

authTest('owner Event page has no Leave Event control', async ({ authenticatedPage, account }) => {
  const session = await signInRest(account);
  const start = addUtcDays(parisToday(), 3);
  const events = await postJson<{ id: string }[]>(`${session.supabaseUrl}/rest/v1/events`, session.headers, {
    kind: 'single_night',
    name: 'Owner Stays',
    start_date: start,
    end_date: start,
    place: 'Berlin'
  });
  const eventId = events[0]?.id;
  expect(eventId).toBeTruthy();

  await authenticatedPage.goto(`/e/${eventId}`);
  await waitForNuxtHydration(authenticatedPage);
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Owner Stays' })).toBeVisible();
  await authExpect(authenticatedPage.getByRole('button', { name: 'Leave Event' })).toHaveCount(0);
  await authExpect(authenticatedPage.getByRole('button', { name: 'Edit event' })).toBeVisible();
});
