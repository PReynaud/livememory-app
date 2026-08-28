import { test, expect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './fixtures/auth.fixture';
import {
  createE2EAccountForTest,
  deleteE2EAccountByEmail,
  deleteE2EAccountForTest,
  generateE2EAccountData
} from './helpers/e2e-account';
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

test('signed-in joiner opens an Event URL once, sees the Bill, and lists it on Concerts and Home', async ({
  page
}, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-owner-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-joiner-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const start = addUtcDays(parisToday(), 4);
    const events = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/events`, ownerSession.headers, {
      kind: 'single_night',
      name: 'Shared Night',
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
      body: JSON.stringify({ notes: 'Back of the room.' })
    });
    expect(notesPatch.ok).toBe(true);

    await page.goto('/login');
    await signInOnPage(page, joiner);
    await expect(page).toHaveURL(/\/home/);

    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Shared Night' })).toBeVisible();
    await expect(page.getByText('Justice')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit event' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add to this night' })).toHaveCount(0);
    await expect(page.getByText('Back of the room.')).toHaveCount(0);

    const joinerSession = await signInRest(joiner);
    const members = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/event_members?event_id=eq.${eventId}&select=event_id,user_id`,
      { headers: joinerSession.headers }
    );
    expect(members.ok).toBe(true);
    const memberRows = await members.json() as { event_id: string; user_id: string }[];
    expect(memberRows).toEqual([{ event_id: eventId, user_id: joiner.userId }]);

    const ownerMembers = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/event_members?event_id=eq.${eventId}&select=user_id`,
      { headers: ownerSession.headers }
    );
    const ownerMemberRows = await ownerMembers.json() as { user_id: string }[];
    expect(ownerMemberRows.some(row => row.user_id === owner.userId)).toBe(false);

    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Shared Night' })).toBeVisible();

    const membersAgain = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/event_members?event_id=eq.${eventId}&select=user_id`,
      { headers: joinerSession.headers }
    );
    const memberRowsAgain = await membersAgain.json() as unknown[];
    expect(memberRowsAgain).toHaveLength(1);

    const joinerNotes = await fetch(
      concertNotesRest(joinerSession.supabaseUrl, `concert_id=eq.${concertId}`),
      { headers: joinerSession.headers }
    );
    expect(joinerNotes.ok).toBe(true);
    expect(await joinerNotes.json()).toEqual([]);

    const joinerConcertNotesCol = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/concerts?id=eq.${concertId}&select=notes`,
      { headers: joinerSession.headers }
    );
    expect(joinerConcertNotesCol.ok).toBe(false);

    await postJson(`${joinerSession.supabaseUrl}/rest/v1/attendance`, joinerSession.headers, {
      concert_id: concertId,
      status: 'going'
    });

    await page.goto('/concerts');
    await waitForNuxtHydration(page);
    await expect(page.getByText('Shared Night')).toBeVisible();
    await expect(page.getByText('Justice')).toBeVisible();

    await page.goto('/home');
    await waitForNuxtHydration(page);
    await expect(page.getByTestId('home-featured').getByText('Shared Night')).toBeVisible();
    await expect(page.getByTestId('home-stats').locator('[data-stat="events"]')).toHaveText(/0/);
    await expect(page.getByTestId('home-stats').locator('[data-stat="going"]')).toHaveText(/1/);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});

test('signed-out Event URL redirects to Sign in and joins after sign-in', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-owner-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-joiner-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const start = addUtcDays(parisToday(), 5);
    const events = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/events`, ownerSession.headers, {
      kind: 'single_night',
      name: 'Guest Join Night',
      start_date: start,
      end_date: start,
      place: 'Lyon'
    });
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    await page.goto(`/e/${eventId}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?redirect=/e/${eventId}`));

    await signInOnPage(page, joiner);
    await expect(page).toHaveURL(new RegExp(`/e/${eventId}$`));
    await expect(page.getByRole('heading', { name: 'Guest Join Night' })).toBeVisible();

    const joinerSession = await signInRest(joiner);
    const members = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/event_members?event_id=eq.${eventId}&select=user_id`,
      { headers: joinerSession.headers }
    );
    const memberRows = await members.json() as { user_id: string }[];
    expect(memberRows).toEqual([{ user_id: joiner.userId }]);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});

test('register from an Event redirect lands on that Event and joins', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-owner-${testInfo.retry}`);
  const joiner = generateE2EAccountData(`${testInfo.project.name}-join-register-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const start = addUtcDays(parisToday(), 6);
    const events = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/events`, ownerSession.headers, {
      kind: 'single_night',
      name: 'Register Join Night',
      start_date: start,
      end_date: start,
      place: 'Nantes'
    });
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    await page.goto(`/e/${eventId}`);
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await waitForNuxtHydration(page);
    await page.getByRole('button', { name: 'Need an account? Sign up' }).click();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await page.getByLabel('Email').fill(joiner.email);
    await page.getByLabel('Username').fill(joiner.username);
    await page.locator('input[name="password"]').fill(joiner.password);
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/e/${eventId}$`));
    await expect(page.getByRole('heading', { name: 'Register Join Night' })).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountByEmail(joiner.email);
  }
});

test('unknown Event URL is a quiet not-found', async ({ page }) => {
  const unknownId = '00000000-0000-4000-8000-000000000000';
  const account = await createE2EAccountForTest(`unknown-event-${Date.now()}`);

  try {
    await page.goto('/login');
    await signInOnPage(page, account);
    await expect(page).toHaveURL(/\/home/);
    await page.goto(`/e/${unknownId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Event not found.' })).toBeVisible();
    await expect(page.getByText('does not exist')).toHaveCount(0);
    await expect(page.getByText('private')).toHaveCount(0);
  } finally {
    await deleteE2EAccountForTest(account.userId);
  }
});

authTest('owner Event page is the unguessable link with Share and no share sheet', async ({
  authenticatedPage,
  account
}) => {
  const session = await signInRest(account);
  const start = addUtcDays(parisToday(), 3);
  const events = await postJson<{ id: string }[]>(`${session.supabaseUrl}/rest/v1/events`, session.headers, {
    kind: 'single_night',
    name: 'Copy Night',
    start_date: start,
    end_date: start,
    place: 'Berlin'
  });
  const eventId = events[0]?.id;
  expect(eventId).toBeTruthy();

  await authenticatedPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await authenticatedPage.goto(`/e/${eventId}`);
  await waitForNuxtHydration(authenticatedPage);
  await authenticatedPage.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Copy Night' })).toBeVisible();
  await authExpect(authenticatedPage.getByRole('button', { name: 'Share event' })).toBeVisible();
  await authExpect(authenticatedPage.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
  await authExpect(authenticatedPage.getByText(/share sheet|invite|directory/i)).toHaveCount(0);

  await authenticatedPage.getByRole('button', { name: 'Share event' }).click();
  const copied = await authenticatedPage.evaluate(async () => navigator.clipboard.readText());
  expect(copied).toContain(`/e/${eventId}`);
});
