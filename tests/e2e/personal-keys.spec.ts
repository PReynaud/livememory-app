import { test, expect } from './fixtures/auth.fixture';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_URL
} from './local-supabase';
import {
  COPY_KEY_FAILED,
  PERSONAL_KEY_ACTIVE,
  PERSONAL_KEY_COPY_NOW,
  PERSONAL_KEY_HELPER
} from '../../shared/domain/personal-keys';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
});

const exchangeKey = async (baseURL: string, key: string) => {
  const response = await fetch(`${baseURL}/api/mcp/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  return { response, payload };
};

test('creates a personal key once, mints a user-scoped client, and rejects it after revoke', async ({
  authenticatedPage,
  account
}) => {
  const page = authenticatedPage;
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByTestId('profile-username')).toHaveText(account.username);
  await expect(page.getByText(PERSONAL_KEY_HELPER)).toBeVisible();
  await expect(page.getByTestId('personal-key-plaintext')).toHaveCount(0);
  await expect(page.getByTestId('personal-key-status')).toHaveCount(0);

  await page.getByTestId('personal-key-create').click();
  const plaintext = page.getByTestId('personal-key-plaintext');
  await expect(plaintext).toBeVisible();
  await expect(page.getByText(PERSONAL_KEY_COPY_NOW)).toBeVisible();
  const key = (await plaintext.innerText()).trim();
  expect(key.startsWith('lm_')).toBe(true);

  await page.getByTestId('personal-key-copy').click();
  const copied = await page.evaluate(async () => navigator.clipboard.readText());
  expect(copied).toBe(key);

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied');
        }
      }
    });
  });
  await page.getByTestId('personal-key-copy').click();
  await expect(page.getByLabel('Notifications (F8)')).toContainText(COPY_KEY_FAILED);

  await page.getByTestId('personal-key-dismiss').click();
  await expect(page.getByTestId('personal-key-plaintext')).toHaveCount(0);
  await expect(page.getByTestId('personal-key-status')).toHaveText(PERSONAL_KEY_ACTIVE);

  await page.reload();
  await waitForNuxtHydration(page);
  await expect(page.getByTestId('personal-key-plaintext')).toHaveCount(0);
  await expect(page.getByTestId('personal-key-status')).toHaveText(PERSONAL_KEY_ACTIVE);

  const baseURL = page.url().replace(/\/profile.*$/, '');
  const minted = await exchangeKey(baseURL, key);
  expect(minted.response.ok).toBe(true);
  const session = minted.payload as {
    access_token?: string;
    user_id?: string;
    username?: string | null;
  };
  expect(session.access_token).toBeTruthy();
  expect(session.user_id).toBe(account.userId);
  expect(session.username).toBe(account.username);

  const supabaseUrl = (process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || LOCAL_SUPABASE_ANON_KEY;
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=username`,
    { headers: restHeaders(session.access_token!, anonKey) }
  );
  expect(profileResponse.ok).toBe(true);
  const profiles = await profileResponse.json() as Array<{ username: string }>;
  expect(profiles).toEqual([{ username: account.username }]);

  const eventsResponse = await fetch(
    `${supabaseUrl}/rest/v1/events?select=id`,
    { headers: restHeaders(session.access_token!, anonKey) }
  );
  expect(eventsResponse.ok).toBe(true);

  await page.getByTestId('personal-key-revoke').click();
  await expect(page.getByTestId('personal-key-status')).toHaveCount(0);
  await expect(page.getByTestId('personal-key-plaintext')).toHaveCount(0);

  const rejected = await exchangeKey(baseURL, key);
  expect(rejected.response.status).toBe(401);
  expect(rejected.response.ok).toBe(false);
});
