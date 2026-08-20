import { test, expect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './fixtures/auth.fixture';
import {
  createE2EAccountForTest,
  deleteE2EAccountForTest
} from './helpers/e2e-account';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';
import { COPY_LINK_FAILED } from '../../app/utils/copy-link';
import { SHARED_LIST_EMPTY, SHARED_LIST_HELPER, SHARED_LIST_NOT_FOUND } from '../../shared/domain/shared-list';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

const signInRest = async (email: string, password: string) => {
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

const parisToday = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

test('disabled and unknown usernames are the same quiet not-found', async ({ page }, testInfo) => {
  const account = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-${testInfo.retry}`);

  try {
    await page.goto(`/u/${account.username}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: SHARED_LIST_NOT_FOUND })).toBeVisible();
    await expect(page.getByText(SHARED_LIST_EMPTY)).toHaveCount(0);
    await expect(page.getByText(/private/i)).toHaveCount(0);

    await page.goto('/u/this-username-does-not-exist');
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: SHARED_LIST_NOT_FOUND })).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(account.userId);
  }
});

authTest('enabling sharing makes /u/:username public; disabling matches unknown username', async ({
  authenticatedPage,
  account
}) => {
  await authenticatedPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await authenticatedPage.getByRole('link', { name: 'Profile' }).click();
  await authExpect(authenticatedPage).toHaveURL(/\/profile/);
  await authExpect(authenticatedPage.getByTestId('profile-username')).toHaveText(account.username);
  await authExpect(authenticatedPage.getByText(SHARED_LIST_HELPER)).toBeVisible();
  await authExpect(authenticatedPage.getByRole('button', { name: 'Copy link' })).toHaveCount(0);

  const sharingSwitch = authenticatedPage.getByRole('switch', { name: 'Shared list' });
  await sharingSwitch.click();
  await authExpect(authenticatedPage.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await authExpect(sharingSwitch).toBeEnabled();

  await authenticatedPage.getByRole('button', { name: 'Copy link' }).click();
  const copied = await authenticatedPage.evaluate(async () => navigator.clipboard.readText());
  expect(copied).toContain(`/u/${account.username}`);

  await authenticatedPage.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied');
        }
      }
    });
  });
  await authenticatedPage.getByRole('button', { name: 'Copy link' }).click();
  await authExpect(authenticatedPage.getByLabel('Notifications (F8)')).toContainText(COPY_LINK_FAILED);

  const browser = authenticatedPage.context().browser();
  expect(browser).toBeTruthy();
  const visitorContext = await browser!.newContext();
  const visitorPage = await visitorContext.newPage();

  try {
    await visitorPage.goto(`/u/${account.username}`);
    await waitForNuxtHydration(visitorPage);
    await expect(visitorPage.getByRole('heading', { name: account.username })).toBeVisible();
    await expect(visitorPage.getByText(SHARED_LIST_EMPTY)).toBeVisible();
    await expect(visitorPage.getByRole('button', { name: 'Add concert' })).toHaveCount(0);
    await expect(visitorPage.getByTestId('route-announcer')).toHaveText(`Shared list for ${account.username}`);

    await sharingSwitch.click();
    await authExpect(authenticatedPage.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
    await authExpect(sharingSwitch).toBeEnabled();

    await visitorPage.goto(`/u/${account.username}`);
    await waitForNuxtHydration(visitorPage);
    await expect(visitorPage.getByRole('heading', { name: SHARED_LIST_NOT_FOUND })).toBeVisible();
    await expect(visitorPage.getByText(SHARED_LIST_EMPTY)).toHaveCount(0);
  } finally {
    await visitorPage.close();
    await visitorContext.close();
  }
});

test('Event URLs still work when sharing is off', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-${testInfo.retry}`);

  try {
    const session = await signInRest(owner.email, owner.password);
    const start = parisToday();
    const eventResponse = await fetch(`${session.supabaseUrl}/rest/v1/events?select=id`, {
      method: 'POST',
      headers: session.headers,
      body: JSON.stringify({
        kind: 'single_night',
        name: 'Private Night',
        start_date: start,
        end_date: start,
        place: 'Paris'
      })
    });
    expect(eventResponse.ok).toBe(true);
    const events = await eventResponse.json() as { id: string }[];
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    await page.goto(`/u/${owner.username}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: SHARED_LIST_NOT_FOUND })).toBeVisible();

    await page.goto('/login');
    await waitForNuxtHydration(page);
    const form = page.locator('form').first();
    await form.getByLabel('Email').fill(owner.email);
    await form.locator('input[name="password"]').fill(owner.password);
    await form.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/home/);

    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Private Night' })).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(owner.userId);
  }
});
