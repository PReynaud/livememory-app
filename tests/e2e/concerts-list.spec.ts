import { test, expect } from './fixtures/auth.fixture';
import { createOwnedEventRest } from './helpers/owned-event-rest';
import { gotoConcertsPeriod } from './helpers/add-concert-sheet';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

test('filters Concerts by type and keeps filters when switching tabs', async ({ authenticatedPage, account }) => {
  await createOwnedEventRest(account, {
    name: 'Club Night',
    start: '2026-12-01',
    place: 'Berlin'
  });
  await createOwnedEventRest(account, {
    kind: 'festival',
    name: 'Rock Week',
    start: '2026-12-10',
    end: '2026-12-12',
    place: 'Paris'
  });

  await gotoConcertsPeriod(authenticatedPage, 'upcoming');
  await waitForNuxtHydration(authenticatedPage);
  await expect(authenticatedPage.getByRole('link', { name: /Club Night/ })).toBeVisible();
  await expect(authenticatedPage.getByRole('link', { name: /Rock Week/ })).toBeVisible();

  await authenticatedPage.getByTestId('concert-filter-open').click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Filter' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Festival' }).click();
  await sheet.getByRole('button', { name: 'Apply' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByLabel('Notifications (F8)')).toContainText('1 filter applied.');
  await expect(authenticatedPage.getByRole('button', { name: 'Remove filter Festival' })).toBeVisible();
  await expect(authenticatedPage.getByRole('link', { name: /Rock Week/ })).toBeVisible();
  await expect(authenticatedPage.getByRole('link', { name: /Club Night/ })).toHaveCount(0);

  await authenticatedPage.getByRole('tab', { name: /Souvenirs/ }).click();
  await expect(authenticatedPage.getByTestId('concerts-tab-empty')).toContainText('No souvenirs yet.');
  await expect(authenticatedPage.getByRole('button', { name: 'Remove filter Festival' })).toHaveCount(0);

  await authenticatedPage.getByRole('tab', { name: /Coming up/ }).click();
  await expect(authenticatedPage.getByRole('button', { name: 'Remove filter Festival' })).toBeVisible();
  await expect(authenticatedPage.getByRole('link', { name: /Rock Week/ })).toBeVisible();
  await expect(authenticatedPage.getByRole('link', { name: /Club Night/ })).toHaveCount(0);
});
