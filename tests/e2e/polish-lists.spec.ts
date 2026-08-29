import { expect, test } from './fixtures/auth.fixture';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { selectAddSheetEvent } from './helpers/add-concert-sheet';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';
import type { E2EAccount } from './helpers/e2e-account';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

const signIn = async (account: E2EAccount) => {
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

const createEvent = async (
  session: Awaited<ReturnType<typeof signIn>>,
  input: { name: string; start: string; place: string }
) => {
  const response = await fetch(`${session.supabaseUrl}/rest/v1/events`, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({
      kind: 'single_night',
      name: input.name,
      start_date: input.start,
      end_date: input.start,
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

  return id;
};

test('announces Home, Concerts, Event, and Profile when routes change', async ({ authenticatedPage, account }) => {
  const announcer = authenticatedPage.getByTestId('route-announcer');
  await expect(announcer).toHaveText('Home');

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await expect(authenticatedPage).toHaveURL(/\/concerts/);
  await expect(announcer).toHaveText('Concerts');

  await authenticatedPage.getByRole('link', { name: 'Profile' }).click();
  await expect(authenticatedPage).toHaveURL(/\/profile/);
  await expect(announcer).toHaveText('Profile');

  const session = await signIn(account);
  const eventId = await createEvent(session, {
    name: 'Announced Night',
    start: '2026-12-01',
    place: 'Paris'
  });

  await authenticatedPage.goto(`/e/${eventId}`);
  await waitForNuxtHydration(authenticatedPage);
  await expect(announcer).toHaveText('Event: Announced Night');
});

test('shows Couldn\'t load with Retry when Home events fail to fetch', async ({ authenticatedPage }) => {
  await authenticatedPage.route('**/rest/v1/events*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'failed',
          code: '500',
          details: '',
          hint: ''
        })
      });
      return;
    }

    await route.continue();
  });

  await authenticatedPage.goto('/home');
  await waitForNuxtHydration(authenticatedPage);
  await expect(authenticatedPage.getByText('Couldn\'t load.')).toBeVisible({ timeout: 15000 });
  await expect(authenticatedPage.getByRole('button', { name: 'Retry' })).toBeVisible();

  await authenticatedPage.unroute('**/rest/v1/events*');
  await authenticatedPage.getByRole('button', { name: 'Retry' }).click();
  await expect(authenticatedPage.getByText('Nothing upcoming.')).toBeVisible({ timeout: 15000 });
});

test('blocks an offline Concert write with a toast and does not create the night', async ({ authenticatedPage }) => {
  await authenticatedPage.locator('main').getByRole('button', { name: 'Add concert' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await selectAddSheetEvent(authenticatedPage, sheet, 'New night');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByLabel('Date').fill('2026-12-01');
  await sheet.getByLabel('City').fill('Paris');

  await authenticatedPage.context().setOffline(true);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage.getByLabel('Notifications (F8)')).toContainText('You\'re offline.');

  await authenticatedPage.context().setOffline(false);
  await authenticatedPage.keyboard.press('Escape');
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await expect(authenticatedPage).toHaveURL(/\/concerts/);
  await expect(authenticatedPage.getByText('Nothing upcoming right now.')).toBeVisible();
});
