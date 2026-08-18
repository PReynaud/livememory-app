import { expect, test } from '@playwright/test';
import {
  createE2EAccountForTest,
  deleteE2EAccountByEmail,
  deleteE2EAccountForTest,
  generateE2EAccountData
} from './helpers/e2e-account';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

const openRegisterForm = async (page: Parameters<typeof waitForNuxtHydration>[0]) => {
  await page.goto('/login');
  await waitForNuxtHydration(page);
  await page.getByRole('button', { name: 'Need an account? Sign up' }).click();
};

test('registers with username and lands on a branded Home', async ({ page }) => {
  const account = generateE2EAccountData('register-happy');

  try {
    await openRegisterForm(page);
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Username').fill(account.username);
    await page.locator('input[name="password"]').fill(account.password);
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();

    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByText('Nothing upcoming.')).toBeVisible();

    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByTestId('profile-username')).toHaveText(account.username);
  } finally {
    await deleteE2EAccountByEmail(account.email);
  }
});

test('rejects a username that differs only by case from an existing one', async ({ page }) => {
  const taken = await createE2EAccountForTest('register-collision', 'Taken_User');
  const challenger = generateE2EAccountData('register-collision-new');

  try {
    await openRegisterForm(page);
    await page.getByLabel('Email').fill(challenger.email);
    await page.getByLabel('Username').fill('taken_user');
    await page.locator('input[name="password"]').fill(challenger.password);
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();

    await expect(page.getByText('This username is taken')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await deleteE2EAccountForTest(taken.userId);
    await deleteE2EAccountByEmail(challenger.email);
  }
});

test('rejects an invalid username charset without creating an account', async ({ page }) => {
  const account = generateE2EAccountData('register-charset');

  try {
    await openRegisterForm(page);
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Username').fill('bad name');
    await page.locator('input[name="password"]').fill(account.password);
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();

    await expect(page.getByText('Username can only contain letters, digits, underscores, and hyphens.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await deleteE2EAccountByEmail(account.email);
  }
});

test('rejects a duplicate email on register', async ({ page }) => {
  const existing = await createE2EAccountForTest('register-dup-email');
  const challenger = generateE2EAccountData('register-dup-email-new');

  try {
    await openRegisterForm(page);
    await page.getByLabel('Email').fill(existing.email);
    await page.getByLabel('Username').fill(challenger.username);
    await page.locator('input[name="password"]').fill(challenger.password);
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();

    await expect(page.getByText('This email already has an account.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await deleteE2EAccountForTest(existing.userId);
    await deleteE2EAccountByEmail(existing.email);
  }
});

test('rejects the wrong email or password on sign in', async ({ page }) => {
  const account = await createE2EAccountForTest('signin-wrong');

  try {
    await page.goto('/login');
    await waitForNuxtHydration(page);
    await page.getByLabel('Email').fill(account.email);
    await page.locator('input[name="password"]').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByText('Email or password is wrong.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await deleteE2EAccountForTest(account.userId);
  }
});
