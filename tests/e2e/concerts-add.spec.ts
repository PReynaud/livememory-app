import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import {
  addSheetArtist,
  addSheetPlace,
  selectAddSheetEvent
} from './helpers/add-concert-sheet';

const expectConcertAddedToast = async (page: Page) => {
  await expect(
    page.getByText('Concert added.', { exact: true }).or(page.getByText('Concerts added.', { exact: true }))
  ).toBeVisible();
};

const expectConcertAddedToastGone = async (page: Page) => {
  await expect(page.getByText('Concert added.', { exact: true })).toHaveCount(0, { timeout: 15000 });
};

test('adds a concert to an owned night with locked date and Place', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New night' }).click();
  await authenticatedPage.getByLabel('Name').fill('Club Night');
  await authenticatedPage.getByLabel('Date').fill('2026-08-18');
  await authenticatedPage.getByLabel('City').fill('Berlin');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  await expect(authenticatedPage.getByText('No concerts on this bill.')).toBeVisible();

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Add concert' })).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: 'Event' })).toHaveValue('Club Night');
  await expect(sheet.getByRole('textbox', { name: 'Date' })).toHaveValue('2026-08-18');
  await expect(addSheetPlace(sheet)).toHaveValue('Berlin');

  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet.getByText('Artist is required.')).toBeVisible();
  await expect(addSheetArtist(sheet)).toHaveAttribute('aria-invalid', 'true');
  await expect(sheet).toBeVisible();

  await sheet.getByLabel('Artist').click();
  await authenticatedPage.keyboard.type('n');
  await expect(addSheetArtist(sheet)).toHaveValue('n');
  await expect(sheet.getByRole('textbox', { name: 'Event' })).toHaveValue('Club Night');

  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByLabel('Time').fill('20:15');
  await sheet.getByRole('button', { name: 'Add another artist' }).click();
  await sheet.getByLabel('Artist 2').fill('Fontaines D.C.');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expectConcertAddedToast(authenticatedPage);
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByText('No concerts on this bill.')).toHaveCount(0);
  await expect(authenticatedPage.getByText('Justice')).toHaveCount(1);
  await expect(authenticatedPage.getByText('Fontaines D.C.')).toHaveCount(1);
  await expect(authenticatedPage.getByText('20:15')).toHaveCount(2);
  await expect(authenticatedPage.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(1);
  await expect(authenticatedPage.getByRole('button', { name: 'Attend this night' })).toHaveCount(0);

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  const nightGroup = authenticatedPage.getByRole('link', { name: /Club Night/ });
  await expect(nightGroup).toBeVisible();
  await expect(authenticatedPage.getByText('Justice').first()).toBeVisible();
  await expect(authenticatedPage.getByText('20:15').first()).toBeVisible();
  const nightChip = authenticatedPage.locator('[data-event-card="group"]').getByRole('button', { name: /Mark as (going|attended)/ });
  await expect(nightChip).toHaveCount(1);
  await expect(nightChip).toHaveAttribute('aria-pressed', 'false');
});

test('adds a festival concert on a picked day and groups it', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New festival' }).click();
  await authenticatedPage.getByLabel('Name').fill('Rock Week');
  await authenticatedPage.getByLabel('Start date').fill('2026-08-20');
  await authenticatedPage.getByLabel('End date').fill('2026-08-22');
  await authenticatedPage.getByLabel('City').fill('Paris');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);

  await authenticatedPage.getByRole('button', { name: 'Add to this festival' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet.getByRole('textbox', { name: 'Event' })).toHaveValue('Rock Week');
  await expect(addSheetPlace(sheet)).toHaveValue('Paris');
  await sheet.getByLabel('Artist').fill('The Last Dinner Party');
  await sheet.getByRole('button', { name: '2026-08-22' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(authenticatedPage.getByText('The Last Dinner Party')).toBeVisible();
  await expect(authenticatedPage.getByText('Saturday 22 Aug')).toBeVisible();
  await expect(authenticatedPage.getByText('Paris').first()).toBeVisible();

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  const compact = authenticatedPage.locator('[data-event-card="compact"]');
  await expect(compact).toBeVisible();
  await expect(compact.getByText('The Last Dinner Party')).toBeVisible();
  await expect(compact.getByText('22/08/2026 · Paris')).toBeVisible();
  await expect(compact.getByText('Rock Week')).toBeVisible();
  await expect(authenticatedPage.getByText('Saturday 22 Aug')).toHaveCount(0);
});

test('opens Add from nav, creates a New night with a concert, and persists', async ({ authenticatedPage, account }) => {
  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Add concert' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Add concert' })).toBeVisible();

  await selectAddSheetEvent(authenticatedPage, sheet, 'New night');
  await sheet.getByLabel('Artist').fill('Local Band');
  await sheet.getByLabel('Name').fill('Warehouse');
  await sheet.getByLabel('Date').fill('2026-12-01');
  await sheet.getByLabel('City').fill('Lyon');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expectConcertAddedToast(authenticatedPage);
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await expect(authenticatedPage).toHaveURL(/\/concerts/);
  await expect(authenticatedPage.getByRole('link', { name: /Warehouse/ })).toBeVisible();
  await expect(authenticatedPage.getByText('Local Band', { exact: true })).toBeVisible();

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

  await selectAddSheetEvent(authenticatedPage, sheet, 'New festival');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByLabel('Name').fill('Rock en Seine');
  await sheet.getByLabel('Start date').fill('2026-08-20');
  await sheet.getByLabel('End date').fill('2026-08-22');
  await sheet.getByLabel('City').fill('Saint-Cloud');
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
  await authenticatedPage.getByLabel('City').fill('Berlin');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);

  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Add concert' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await selectAddSheetEvent(authenticatedPage, sheet, 'Club Night');
  await sheet.getByLabel('Artist').fill('Fontaines D.C.');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(authenticatedPage.getByText('Fontaines D.C.')).toBeVisible();
  await expect(authenticatedPage.getByText('No concerts on this bill.')).toHaveCount(0);
  await expect(authenticatedPage.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(1);
  await expect(authenticatedPage.getByRole('button', { name: 'Attend this night' })).toHaveCount(0);
});

const createOwnedNight = async (
  page: Page,
  name: string,
  date: string,
  place: string
) => {
  await page.getByRole('link', { name: 'Concerts' }).click();
  await page.getByRole('button', { name: 'New night' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Date').fill(date);
  await page.getByLabel('City').fill(place);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  return new URL(page.url()).pathname;
};

test('attaches a timed concert on the same Event without inserting', async ({ authenticatedPage }) => {
  await createOwnedNight(authenticatedPage, 'Club Night', '2026-08-18', 'Berlin');
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByLabel('Time').fill('20:15');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expectConcertAddedToast(authenticatedPage);
  await expect(authenticatedPage.getByText('Justice')).toHaveCount(1);
  await expectConcertAddedToastGone(authenticatedPage);

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const again = authenticatedPage.getByRole('dialog');
  await again.getByLabel('Artist').fill('Justice');
  await again.getByLabel('Time').fill('20:15');
  await again.getByRole('button', { name: 'Save' }).click();

  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expect(authenticatedPage.getByText('Justice')).toHaveCount(1);
  await expect(authenticatedPage.getByText('Concert added.', { exact: true })).toHaveCount(0);
  await expect(authenticatedPage.getByText('This concert already exists on another Event.')).toHaveCount(0);
});

test('attaches onto another Event and shows the other-Event copy', async ({ authenticatedPage }) => {
  const firstPath = await createOwnedNight(authenticatedPage, 'Club Night', '2026-08-18', 'Berlin');
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const firstSheet = authenticatedPage.getByRole('dialog');
  await firstSheet.getByLabel('Artist').fill('Justice');
  await firstSheet.getByLabel('Time').fill('20:15');
  await firstSheet.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage.getByText('Justice')).toBeVisible();

  await createOwnedNight(authenticatedPage, 'Other Night', '2026-08-18', 'Berlin');
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByLabel('Time').fill('20:15');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(authenticatedPage.getByText('This concert already exists on another Event.', { exact: true })).toBeVisible();
  await expect(authenticatedPage).toHaveURL(new RegExp(`${firstPath}$`));
  await expect(authenticatedPage.getByRole('heading', { name: 'Club Night' })).toBeVisible();
  await expect(authenticatedPage.getByText('Justice')).toHaveCount(1);
});

test('refuses a timed match at a different Place and stays in the sheet', async ({ authenticatedPage }) => {
  await createOwnedNight(authenticatedPage, 'Club Night', '2026-08-18', 'Berlin');
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const firstSheet = authenticatedPage.getByRole('dialog');
  await firstSheet.getByLabel('Artist').fill('Justice');
  await firstSheet.getByLabel('Time').fill('20:15');
  await firstSheet.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage.getByText('Justice')).toBeVisible();

  const parisPath = await createOwnedNight(authenticatedPage, 'Paris Night', '2026-08-18', 'Paris');
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByLabel('Time').fill('20:15');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('This concert already exists at a different Place.')).toBeVisible();
  await expect(authenticatedPage).toHaveURL(new RegExp(`${parisPath}$`));
  await expect(sheet.getByRole('combobox', { name: 'Artist' })).toHaveValue('Justice');
});

test('keeps the Add draft when needs_choice is cancelled', async ({ authenticatedPage }) => {
  await createOwnedNight(authenticatedPage, 'Club Night', '2026-08-18', 'Berlin');
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expectConcertAddedToast(authenticatedPage);
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const again = authenticatedPage.getByRole('dialog');
  await again.getByLabel('Artist').fill('Justice');
  await again.getByRole('button', { name: 'Save' }).click();

  await expect(again.getByText('This artist and date already exist. Attach to the existing concert or create another.')).toBeVisible();
  await again.getByRole('button', { name: 'Cancel' }).click();
  await expect(again).toBeVisible();
  await expect(again.getByRole('combobox', { name: 'Artist' })).toHaveValue('Justice');
  await expect(again.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(authenticatedPage.getByText('Justice')).toHaveCount(1);
});

test('attaches after needs_choice and writes the draft clock', async ({ authenticatedPage }) => {
  await createOwnedNight(authenticatedPage, 'Club Night', '2026-08-18', 'Berlin');
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expectConcertAddedToast(authenticatedPage);
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expectConcertAddedToastGone(authenticatedPage);

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const again = authenticatedPage.getByRole('dialog');
  await again.getByLabel('Artist').fill('Justice');
  await again.getByLabel('Time').fill('21:00');
  await again.getByRole('button', { name: 'Save' }).click();

  await expect(again.getByText('This artist and date already exist. Attach to the existing concert or create another.')).toBeVisible();
  await again.getByRole('button', { name: 'Attach' }).click();

  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expect(authenticatedPage.getByText('Justice')).toHaveCount(1);
  await expect(authenticatedPage.getByText('21:00')).toBeVisible();
  await expect(authenticatedPage.getByText('Concert added.', { exact: true })).toHaveCount(0);
});

test('creates a second row after needs_choice', async ({ authenticatedPage }) => {
  await createOwnedNight(authenticatedPage, 'Club Night', '2026-08-18', 'Berlin');
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expectConcertAddedToast(authenticatedPage);
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expectConcertAddedToastGone(authenticatedPage);

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const again = authenticatedPage.getByRole('dialog');
  await again.getByLabel('Artist').fill('Justice');
  await again.getByRole('button', { name: 'Save' }).click();

  await expect(again.getByText('This artist and date already exist. Attach to the existing concert or create another.')).toBeVisible();
  await again.getByRole('button', { name: 'Create' }).click();

  await expectConcertAddedToast(authenticatedPage);
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expect(authenticatedPage.getByText('Justice')).toHaveCount(2);
});

test('Escape dismisses needs_choice and keeps the Add draft', async ({ authenticatedPage }) => {
  await createOwnedNight(authenticatedPage, 'Club Night', '2026-08-18', 'Berlin');
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expectConcertAddedToast(authenticatedPage);
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const again = authenticatedPage.getByRole('dialog');
  await again.getByLabel('Artist').fill('Justice');
  await again.getByRole('button', { name: 'Save' }).click();

  await expect(again.getByText('This artist and date already exist. Attach to the existing concert or create another.')).toBeVisible();
  await authenticatedPage.keyboard.press('Escape');

  await expect(again).toBeVisible();
  await expect(again.getByRole('combobox', { name: 'Artist' })).toHaveValue('Justice');
  await expect(again.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(again.getByRole('button', { name: 'Attach' })).toHaveCount(0);
});
