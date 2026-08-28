import { test, expect } from './fixtures/auth.fixture';
import { createFestivalFromAddSheet } from './helpers/add-concert-sheet';

const createFestivalWithConcert = async (
  page: import('@playwright/test').Page,
  input: { name: string; start: string; end: string; place: string; artist: string; date: string }
) => {
  await createFestivalFromAddSheet(page, input);
};

test('owner edits Event name and Place from the glass sheet', async ({ authenticatedPage }) => {
  await createFestivalWithConcert(authenticatedPage, {
    name: 'Rock Week',
    start: '2026-08-20',
    end: '2026-08-22',
    place: 'Paris',
    artist: 'Justice',
    date: '2026-08-20'
  });

  await authenticatedPage.getByRole('button', { name: 'Edit event' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Edit event' })).toBeVisible();
  await expect(sheet.getByLabel('Name')).toHaveValue('Rock Week');
  await expect(sheet.getByRole('textbox', { name: 'Place' })).toHaveValue('Paris');

  await sheet.getByLabel('Name').fill('Rock Week Paris');
  await sheet.getByRole('textbox', { name: 'Place' }).fill('La Villette');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByRole('heading', { name: 'Rock Week Paris' })).toBeVisible();
  await expect(authenticatedPage.getByText('La Villette')).toBeVisible();
});

test('invalid Concert date shows the named Event range copy', async ({ authenticatedPage }) => {
  await createFestivalWithConcert(authenticatedPage, {
    name: 'Rock Week',
    start: '2026-08-20',
    end: '2026-08-22',
    place: 'Paris',
    artist: 'Justice',
    date: '2026-08-20'
  });

  await authenticatedPage.getByRole('button', { name: 'Edit event' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Start date').fill('2026-08-10');
  await sheet.getByLabel('End date').fill('2026-08-12');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet.getByText('This date is outside the Event.')).toBeVisible();
  await expect(sheet.getByText(/20\/08\/2026/)).toBeVisible();
  await expect(sheet.getByText(/These concerts would break the Event rules/)).toBeVisible();
  await expect(sheet).toBeVisible();
});

test('adding a Stage without assigning Concerts still saves the Event', async ({ authenticatedPage }) => {
  await createFestivalWithConcert(authenticatedPage, {
    name: 'Rock Week',
    start: '2026-08-20',
    end: '2026-08-22',
    place: 'Paris',
    artist: 'Justice',
    date: '2026-08-20'
  });

  await authenticatedPage.getByRole('button', { name: 'Edit event' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Add stage' }).click();
  await sheet.getByLabel('Stage 1').fill('Main');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByRole('heading', { name: 'Rock Week' })).toBeVisible();
  await expect(authenticatedPage.getByText('Justice')).toBeVisible();
});
