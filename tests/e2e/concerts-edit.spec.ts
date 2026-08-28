import { test, expect } from './fixtures/auth.fixture';
import { addSheetArtist, addSheetEventControl, createNightFromAddSheet } from './helpers/add-concert-sheet';
import { createOwnedEventRest } from './helpers/owned-event-rest';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

const addOwnedNightWithConcert = async (
  page: import('@playwright/test').Page,
  input: { name: string; date: string; place: string; artist: string }
) => {
  return createNightFromAddSheet(page, input);
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
  await expect(addSheetArtist(sheet)).toHaveValue('Justice');
  await expect(addSheetEventControl(sheet)).toContainText('Club Night');
  await expect(sheet.getByPlaceholder('Private. Never on your public profile.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Add another artist' })).toHaveCount(0);

  await sheet.getByPlaceholder('Private. Never on your public profile.').fill('Back of the room.');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByText('Concert saved.', { exact: true })).toBeVisible();

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

test('owner moves a Concert between two owned Events without duplicating', async ({ authenticatedPage, account }) => {
  const sourcePath = await addOwnedNightWithConcert(authenticatedPage, {
    name: 'Club Night',
    date: '2026-08-18',
    place: 'Berlin',
    artist: 'Justice'
  });

  await authenticatedPage.getByRole('button', { name: 'Edit Justice' }).click();
  const notesSheet = authenticatedPage.getByRole('dialog');
  await expect(notesSheet.getByRole('heading', { name: 'Edit concert' })).toBeVisible();
  await expect(notesSheet.getByRole('combobox', { name: 'Artist' })).toHaveValue('Justice');
  await notesSheet.getByPlaceholder('Private. Never on your public profile.').fill('Back of the room.');
  await notesSheet.getByRole('button', { name: 'Save' }).click();
  await expect(notesSheet).toHaveCount(0);
  await expect(authenticatedPage.getByText('Concert saved.', { exact: true })).toBeVisible();
  await authenticatedPage.getByRole('button', { name: 'Mark as attended' }).click();
  await expect(authenticatedPage.getByRole('button', { name: 'Mark as attended' })).toHaveAttribute('aria-pressed', 'true');

  const other = await createOwnedEventRest(account, {
    name: 'Other Night',
    start: '2026-08-18',
    place: 'Berlin'
  });
  const targetPath = other.path;

  await authenticatedPage.goto(sourcePath);
  await waitForNuxtHydration(authenticatedPage);
  await expect(authenticatedPage.getByRole('heading', { name: 'Club Night' })).toBeVisible();
  await expect(authenticatedPage.getByText('Justice')).toBeVisible();
  await authenticatedPage.getByRole('button', { name: 'Edit Justice' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Edit concert' })).toBeVisible();
  await expect(sheet.getByPlaceholder('Private. Never on your public profile.')).toHaveValue('Back of the room.');
  await addSheetEventControl(sheet).click();
  await authenticatedPage.getByRole('option', { name: 'Other Night' }).click();
  await expect(sheet.getByText(/joiner/i)).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage).toHaveURL(new RegExp(`${targetPath}$`));
  await expect(authenticatedPage.getByRole('heading', { name: 'Other Night' })).toBeVisible();
  await expect(authenticatedPage.getByText('Justice')).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: 'Mark as attended' })).toHaveAttribute('aria-pressed', 'true');

  await authenticatedPage.getByRole('button', { name: 'Edit Justice' }).click();
  await expect(authenticatedPage.getByRole('dialog').getByPlaceholder('Private. Never on your public profile.')).toHaveValue('Back of the room.');
  await authenticatedPage.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);

  await authenticatedPage.goto(sourcePath);
  await waitForNuxtHydration(authenticatedPage);
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
