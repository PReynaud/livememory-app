import type { Page } from '@playwright/test';
import { expect, test as base } from '@playwright/test';
import { createE2EAccountForTest, deleteE2EAccountForTest, type E2EAccount } from './helpers/e2e-account';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

interface AuthFixtures {
  account: E2EAccount;
  authenticatedPage: Page;
}

export const test = base.extend<AuthFixtures>({
  account: async ({ page: _page }, use, testInfo) => {
    const seed = `${testInfo.project.name}-${testInfo.title}-${testInfo.retry}`;
    const account = await createE2EAccountForTest(seed);

    try {
      await use(account);
    } finally {
      await deleteE2EAccountForTest(account.userId);
    }
  },
  authenticatedPage: async ({ page, account }, use) => {
    await page.goto('/login');
    await waitForNuxtHydration(page);

    const form = page.locator('form').first();

    await form.getByLabel('Email').fill(account.email);
    await form.locator('input[name="password"]').fill(account.password);
    await form.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/home/);

    await use(page);
  }
});

export { expect };
