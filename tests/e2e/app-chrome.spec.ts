import { expect, test } from './fixtures/auth.fixture';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

test('marks only the current destination and keeps four nav targets', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/concerts');
  await waitForNuxtHydration(authenticatedPage);

  const nav = authenticatedPage.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveCount(3);
  await expect(nav.getByRole('button')).toHaveCount(1);

  await expect(nav.getByRole('link', { name: 'Concerts' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current', /.+/);
  await expect(nav.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current', /.+/);

  await nav.getByRole('link', { name: 'Profile' }).click();
  await authenticatedPage.waitForURL(/\/profile/);
  await expect(nav.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Concerts' })).not.toHaveAttribute('aria-current', /.+/);

  await nav.getByRole('button', { name: 'Add concert' }).click();
  await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
});
