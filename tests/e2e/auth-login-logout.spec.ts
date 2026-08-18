import { expect, test } from './fixtures/auth.fixture';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

test('logs in with a generated account and allows logout from Profile', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.getByRole('heading', { name: 'Home' })).toBeVisible();

  await authenticatedPage.goto('/');
  await waitForNuxtHydration(authenticatedPage);

  const guestHeader = authenticatedPage.getByRole('banner');
  await expect(guestHeader.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  await expect(guestHeader.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  await guestHeader.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(authenticatedPage).toHaveURL(/\/home/);

  await authenticatedPage.getByRole('link', { name: 'Profile' }).click();
  await expect(authenticatedPage).toHaveURL(/\/profile/);
  await expect(authenticatedPage.getByRole('button', { name: 'Sign out' })).toBeVisible();

  await authenticatedPage.getByRole('button', { name: 'Sign out' }).click();

  await expect(authenticatedPage).toHaveURL(/\/login/);
  await expect(authenticatedPage.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await authenticatedPage.goto('/home');
  await expect(authenticatedPage).toHaveURL(/\/login/);
  await authenticatedPage.goto('/concerts');
  await expect(authenticatedPage).toHaveURL(/\/login/);
});
