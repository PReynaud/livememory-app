import { expect, test } from '@playwright/test';
import { createE2EAccountForTest, deleteE2EAccountForTest } from './helpers/e2e-account';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

test('an unconnected user has no Home assistant action and can connect from Profile', async ({ page }, testInfo) => {
  const account = await createE2EAccountForTest(`agent-${testInfo.workerIndex}-${testInfo.retry}`);
  try {
    await page.goto('/login');
    await waitForNuxtHydration(page);
    await page.getByLabel('Email').fill(account.email);
    await page.locator('input[name="password"]').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByTestId('home-assistant-action')).toHaveCount(0);
    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page.getByTestId('agent-connection-key')).toBeVisible();
    await expect(page.getByTestId('agent-connection-connect')).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(account.userId);
  }
});
