import { expect, test } from './fixtures/auth.fixture';

test('logs in with a generated account and allows logout from Profile', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.getByRole('heading', { name: 'Home' })).toBeVisible();

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
