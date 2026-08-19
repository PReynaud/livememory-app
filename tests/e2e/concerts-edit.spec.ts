import { test, expect } from './fixtures/auth.fixture';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

const addOwnedNightWithConcert = async (
  page: import('@playwright/test').Page,
  input: { name: string; date: string; place: string; artist: string }
) => {
  await page.getByRole('link', { name: 'Concerts' }).click();
  await page.getByRole('button', { name: 'New night' }).click();
  await page.getByLabel('Name').fill(input.name);
  await page.getByLabel('Date').fill(input.date);
  await page.getByLabel('Place').fill(input.place);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);

  await page.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Artist').fill(input.artist);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText(input.artist)).toBeVisible();

  return new URL(page.url()).pathname;
};

test('owner opens the glass edit sheet from the Event row, saves notes, and deletes the last Concert', async ({ authenticatedPage }) => {
  const eventPath = await addOwnedNightWithConcert(authenticatedPage, {
    name: 'Club Night',
    date: '2026-08-18',
    place: 'Berlin',
    artist: 'Justice'
  });

  await authenticatedPage.getByRole('button', { name: 'Edit Justice' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Edit concert' })).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: 'Artist' })).toHaveValue('Justice');
  await expect(sheet.getByRole('textbox', { name: 'Event' })).toHaveValue('Club Night');
  await expect(sheet.getByPlaceholder('Private. Never on your public profile.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Add another' })).toHaveCount(0);

  await sheet.getByPlaceholder('Private. Never on your public profile.').fill('Back of the room.');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByText('Concert saved.')).toBeVisible();

  await authenticatedPage.getByRole('button', { name: 'Edit Justice' }).click();
  await expect(authenticatedPage.getByRole('dialog').getByPlaceholder('Private. Never on your public profile.')).toHaveValue('Back of the room.');

  await authenticatedPage.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(authenticatedPage.getByRole('dialog').getByText('Delete this concert?')).toBeVisible();
  await authenticatedPage.getByRole('dialog').getByRole('button', { name: 'Delete concert' }).click();
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expect(authenticatedPage).toHaveURL(new RegExp(`${eventPath}$`));
  await expect(authenticatedPage.getByRole('heading', { name: 'Club Night' })).toBeVisible();
  await expect(authenticatedPage.getByText('No concerts on this bill.')).toBeVisible();
  await expect(authenticatedPage.getByText('Justice')).toHaveCount(0);
});

test('compact card chip cycles Attendance and does not open Edit', async ({ authenticatedPage }) => {
  await addOwnedNightWithConcert(authenticatedPage, {
    name: 'Solo Night',
    date: '2026-08-18',
    place: 'Berlin',
    artist: 'Justice'
  });

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await waitForNuxtHydration(authenticatedPage);
  const compact = authenticatedPage.locator('[data-event-card="compact"]');
  await expect(compact).toBeVisible();

  await compact.getByRole('button', { name: 'Mark as attended' }).click();
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expect(compact.getByRole('button', { name: 'Mark as attended' })).toHaveAttribute('aria-pressed', 'true');
});
