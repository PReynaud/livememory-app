import { test, expect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './fixtures/auth.fixture';
import { createE2EAccountForTest, deleteE2EAccountForTest } from './helpers/e2e-account';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

const UNKNOWN_EVENT_ID = '00000000-0000-4000-8000-000000000000';

test('unsigned Event URL redirects to Sign in with redirect', async ({ page }) => {
  await page.goto(`/e/${UNKNOWN_EVENT_ID}`);
  await waitForNuxtHydration(page);

  await expect(page).toHaveURL(new RegExp(`/login\\?.*redirect=.*${UNKNOWN_EVENT_ID}`));
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('unsigned Concerts URL redirects to Sign in with redirect', async ({ page }) => {
  await page.goto('/concerts');
  await waitForNuxtHydration(page);

  await expect(page).toHaveURL(/\/login\?.*redirect=.*concerts/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

authTest('creates a festival, lists it on Concerts, and opens an empty Bill', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authExpect(authenticatedPage).toHaveURL(/\/concerts/);
  await authExpect(authenticatedPage.getByText('No shows yet.')).toBeVisible();

  await authenticatedPage.getByRole('button', { name: 'New festival' }).click();
  await authExpect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await authenticatedPage.getByLabel('Name').fill('Rock Week');
  await authenticatedPage.getByLabel('Start date').fill('2026-08-20');
  await authenticatedPage.getByLabel('End date').fill('2026-08-22');
  await authenticatedPage.getByLabel('City').fill('Paris');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();

  await authExpect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  const festivalUrl = authenticatedPage.url();
  const festivalId = festivalUrl.split('/e/')[1];
  authExpect(festivalId).not.toMatch(/rock/i);
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Rock Week' })).toBeVisible();
  await authExpect(authenticatedPage.getByText('20/08/2026 – 22/08/2026')).toBeVisible();
  await authExpect(authenticatedPage.getByText('Paris')).toBeVisible();
  await authExpect(authenticatedPage.getByText('No concerts on this bill.')).toBeVisible();
  await authExpect(authenticatedPage.getByRole('link', { name: 'Concerts' })).toBeVisible();

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authExpect(authenticatedPage).toHaveURL(/\/concerts/);
  const festivalGroup = authenticatedPage.getByRole('link', { name: /Rock Week/ });
  await authExpect(festivalGroup).toBeVisible();
  await authExpect(festivalGroup.getByText('20/08/2026 – 22/08/2026')).toBeVisible();
  await authExpect(festivalGroup.getByText('Paris')).toBeVisible();

  await festivalGroup.click();
  await authExpect(authenticatedPage).toHaveURL(new RegExp(`/e/${festivalId}$`));
  await authExpect(authenticatedPage.getByText('No concerts on this bill.')).toBeVisible();
});

authTest('creates a single_night with one date and lists a header-only group', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New night' }).click();
  await authenticatedPage.getByLabel('Name').fill('Club Night');
  await authenticatedPage.getByLabel('Date').fill('2026-08-10');
  await authenticatedPage.getByLabel('City').fill('Berlin');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();

  await authExpect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Club Night' })).toBeVisible();
  await authExpect(authenticatedPage.getByText('10/08/2026')).toBeVisible();
  await authExpect(authenticatedPage.getByText('No concerts on this bill.')).toBeVisible();

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  const nightGroup = authenticatedPage.getByRole('link', { name: /Club Night/ });
  await authExpect(nightGroup).toBeVisible();
  await authExpect(nightGroup.getByText('10/08/2026')).toBeVisible();
  await authExpect(nightGroup.getByText('Berlin')).toBeVisible();
});

authTest('stays on the festival form for inverted dates and missing required fields', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New festival' }).click();

  await authenticatedPage.getByLabel('Name').fill('Bad Range');
  await authenticatedPage.getByLabel('Start date').fill('2026-08-22');
  await authenticatedPage.getByLabel('End date').fill('2026-08-20');
  await authenticatedPage.getByLabel('City').fill('Paris');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();

  await authExpect(authenticatedPage).toHaveURL(/\/concerts/);
  await authExpect(authenticatedPage.getByText('End date cannot be before the start date.')).toBeVisible();
  await authExpect(authenticatedPage.getByRole('link', { name: /Bad Range/ })).toHaveCount(0);

  await authenticatedPage.getByLabel('Name').fill('');
  await authenticatedPage.getByLabel('End date').fill('2026-08-24');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();

  await authExpect(authenticatedPage).toHaveURL(/\/concerts/);
  await authExpect(authenticatedPage.getByText('Name is required.')).toBeVisible();
});

authTest('unknown Event URLs are quiet not-found and a stranger joins via the URL', async ({ authenticatedPage }, testInfo) => {
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Home' })).toBeVisible();
  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New night' }).click();
  await authenticatedPage.getByLabel('Name').fill('Private Night');
  await authenticatedPage.getByLabel('Date').fill('2026-08-12');
  await authenticatedPage.getByLabel('City').fill('Lyon');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
  await authExpect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  const ownedPath = new URL(authenticatedPage.url()).pathname;

  await authenticatedPage.goto(`/e/${UNKNOWN_EVENT_ID}`);
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Event not found.' })).toBeVisible();
  await authExpect(authenticatedPage.getByText('Private Night')).toHaveCount(0);

  await authenticatedPage.goto('/e/not-a-uuid');
  await authExpect(authenticatedPage.getByRole('heading', { name: 'Event not found.' })).toBeVisible();

  const other = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-other-${testInfo.retry}`);
  try {
    await authenticatedPage.getByRole('link', { name: 'Profile' }).click();
    await authenticatedPage.getByRole('button', { name: 'Sign out' }).click();
    await authExpect(authenticatedPage).toHaveURL(/\/login/);

    await waitForNuxtHydration(authenticatedPage);
    const form = authenticatedPage.locator('form').first();
    await form.getByLabel('Email').fill(other.email);
    await form.locator('input[name="password"]').fill(other.password);
    await form.getByRole('button', { name: 'Sign in' }).click();
    await authExpect(authenticatedPage).not.toHaveURL(/\/login/);

    await authenticatedPage.goto(ownedPath);
    await waitForNuxtHydration(authenticatedPage);
    await authExpect(authenticatedPage.getByRole('heading', { name: 'Private Night' })).toBeVisible();
    await authExpect(authenticatedPage.getByRole('button', { name: 'Edit event' })).toHaveCount(0);
    await authExpect(authenticatedPage.getByRole('button', { name: 'Add to this night' })).toHaveCount(0);
  } finally {
    await deleteE2EAccountForTest(other.userId);
  }
});
