import { test, expect } from '@playwright/test';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

test('landing page shows sign in', async ({ page }) => {
  await page.goto('/');
  await waitForNuxtHydration(page);

  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
});
