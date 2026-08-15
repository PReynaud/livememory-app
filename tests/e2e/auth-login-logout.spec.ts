import { expect, test } from './fixtures/auth.fixture';

test('logs in with a generated account and allows logout', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();

  await authenticatedPage.getByRole('button', { name: 'Sign out' }).first().click();

  await expect(authenticatedPage).toHaveURL(/\/login/);
  await expect(authenticatedPage.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
