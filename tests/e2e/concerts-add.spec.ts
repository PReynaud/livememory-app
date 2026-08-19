import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

const expectConcertAddedToast = async (page: Page) => {
  await expect(page.getByText('Concert added.', { exact: true })).toBeVisible();
};

test('adds a concert to an owned night with locked date and Place', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New night' }).click();
  await authenticatedPage.getByLabel('Name').fill('Club Night');
  await authenticatedPage.getByLabel('Date').fill('2026-08-18');
  await authenticatedPage.getByLabel('Place').fill('Berlin');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  await expect(authenticatedPage.getByText('No concerts on this bill.')).toBeVisible();

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Add concert' })).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: 'Event' })).toHaveValue('Club Night');
  await expect(sheet.getByRole('textbox', { name: 'Date' })).toHaveValue('2026-08-18');
  await expect(sheet.getByRole('textbox', { name: 'Place' })).toHaveValue('Berlin');

  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet.getByText('Artist is required.')).toBeVisible();
  await expect(sheet).toBeVisible();

  await sheet.getByLabel('Artist').click();
  await authenticatedPage.keyboard.type('n');
  await expect(sheet.getByRole('textbox', { name: 'Artist' })).toHaveValue('n');
  await expect(sheet.getByRole('textbox', { name: 'Event' })).toHaveValue('Club Night');

  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByLabel('Time').fill('20:15');
  await sheet.getByRole('button', { name: 'Add another' }).click();
  await expectConcertAddedToast(authenticatedPage);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: 'Artist' })).toHaveValue('');
  await expect(sheet.getByRole('textbox', { name: 'Time' })).toHaveValue('20:15');
  await expect(sheet.getByRole('textbox', { name: 'Event' })).toHaveValue('Club Night');
  await expect(sheet.getByRole('textbox', { name: 'Date' })).toHaveValue('2026-08-18');
  await expect(sheet.getByRole('textbox', { name: 'Place' })).toHaveValue('Berlin');

  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByText('No concerts on this bill.')).toHaveCount(0);
  await expect(authenticatedPage.getByText('Justice')).toHaveCount(2);
  await expect(authenticatedPage.getByText('20:15')).toHaveCount(2);

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  const nightGroup = authenticatedPage.getByRole('link', { name: /Club Night/ });
  await expect(nightGroup).toBeVisible();
  await expect(authenticatedPage.getByText('Justice').first()).toBeVisible();
  await expect(authenticatedPage.getByText('20:15').first()).toBeVisible();
});

test('adds a festival concert on a picked day and groups it', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New festival' }).click();
  await authenticatedPage.getByLabel('Name').fill('Rock Week');
  await authenticatedPage.getByLabel('Start date').fill('2026-08-20');
  await authenticatedPage.getByLabel('End date').fill('2026-08-22');
  await authenticatedPage.getByLabel('Place').fill('Paris');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);

  await authenticatedPage.getByRole('button', { name: 'Add to this festival' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet.getByRole('textbox', { name: 'Event' })).toHaveValue('Rock Week');
  await expect(sheet.getByRole('textbox', { name: 'Place' })).toHaveValue('Paris');
  await sheet.getByLabel('Artist').fill('The Last Dinner Party');
  await sheet.getByRole('button', { name: '2026-08-22' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(authenticatedPage.getByText('The Last Dinner Party')).toBeVisible();
  await expect(authenticatedPage.getByText('Saturday 22 Aug')).toBeVisible();
  await expect(authenticatedPage.getByText('Paris').first()).toBeVisible();

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await expect(authenticatedPage.getByRole('link', { name: /Rock Week/ })).toBeVisible();
  await expect(authenticatedPage.getByText('The Last Dinner Party')).toBeVisible();
  await expect(authenticatedPage.getByText('Saturday 22 Aug')).toBeVisible();
});

test('opens Add from nav, creates a New night with a concert, and persists', async ({ authenticatedPage, account }) => {
  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Add concert' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Add concert' })).toBeVisible();

  await sheet.getByLabel('Event').click();
  await authenticatedPage.getByRole('option', { name: 'New night' }).click();
  await sheet.getByLabel('Artist').fill('Local Band');
  await sheet.getByLabel('Name').fill('Warehouse');
  await sheet.getByLabel('Date').fill('2026-12-01');
  await sheet.getByLabel('Place').fill('Lyon');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expectConcertAddedToast(authenticatedPage);
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await expect(authenticatedPage.getByRole('link', { name: /Warehouse/ })).toBeVisible();
  await expect(authenticatedPage.getByText('Local Band')).toBeVisible();

  const eventLink = authenticatedPage.getByRole('link', { name: /Warehouse/ });
  await eventLink.click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  const eventPath = new URL(authenticatedPage.url()).pathname;
  await expect(authenticatedPage.getByText('Local Band')).toBeVisible();

  await authenticatedPage.getByRole('link', { name: 'Profile' }).click();
  await authenticatedPage.getByRole('button', { name: 'Sign out' }).click();
  await expect(authenticatedPage).toHaveURL(/\/login/);

  await waitForNuxtHydration(authenticatedPage);
  const form = authenticatedPage.locator('form').first();
  await form.getByLabel('Email').fill(account.email);
  await form.locator('input[name="password"]').fill(account.password);
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(authenticatedPage).not.toHaveURL(/\/login/);

  await authenticatedPage.goto(eventPath);
  await expect(authenticatedPage.getByRole('heading', { name: 'Warehouse' })).toBeVisible();
  await expect(authenticatedPage.getByText('Local Band')).toBeVisible();
});

test('n opens the sheet and Escape closes it', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.getByRole('heading', { name: 'Home' })).toBeVisible();
  await authenticatedPage.locator('body').click({ position: { x: 8, y: 8 } });
  await authenticatedPage.keyboard.press('Control+n');
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await authenticatedPage.keyboard.press('n');
  await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
  await expect(authenticatedPage.getByRole('heading', { name: 'Add concert' })).toBeVisible();
  await authenticatedPage.keyboard.press('Escape');
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
});

test('creates a New festival from the Add sheet on a non-start day', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Add concert' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Add concert' })).toBeVisible();

  await sheet.getByLabel('Event').click();
  await authenticatedPage.getByRole('option', { name: 'New festival' }).click();
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByLabel('Name').fill('Rock en Seine');
  await sheet.getByLabel('Start date').fill('2026-08-20');
  await sheet.getByLabel('End date').fill('2026-08-22');
  await sheet.getByLabel('Place').fill('Saint-Cloud');
  await sheet.getByRole('button', { name: '2026-08-21' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expectConcertAddedToast(authenticatedPage);
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('link', { name: /Rock en Seine/ }).click();
  await expect(authenticatedPage.getByText('Justice')).toBeVisible();
  await expect(authenticatedPage.getByText('Friday 21 Aug')).toBeVisible();
});

test('nav Add onto an existing Event stores the concert', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New night' }).click();
  await authenticatedPage.getByLabel('Name').fill('Club Night');
  await authenticatedPage.getByLabel('Date').fill('2026-08-18');
  await authenticatedPage.getByLabel('Place').fill('Berlin');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);

  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Add concert' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Event').click();
  await authenticatedPage.getByRole('option', { name: 'Club Night' }).click();
  await sheet.getByLabel('Artist').fill('Fontaines D.C.');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(authenticatedPage.getByText('Fontaines D.C.')).toBeVisible();
  await expect(authenticatedPage.getByText('No concerts on this bill.')).toHaveCount(0);
});
