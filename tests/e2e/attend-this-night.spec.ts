import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { createNightFromAddSheet } from './helpers/add-concert-sheet';
import { createOwnedEventRest } from './helpers/owned-event-rest';

const chipFor = (page: Page, artist: string) => {
  return page
    .getByRole('button', { name: `Edit ${artist}` })
    .locator('xpath=..')
    .getByRole('button', { name: /Mark as (going|attended)/ });
};

const createNightWithArtists = async (
  page: Page,
  input: { name: string; date: string; place: string; artists: string[] }
) => {
  const [first, ...rest] = input.artists;
  await createNightFromAddSheet(page, {
    name: input.name,
    date: input.date,
    place: input.place,
    artist: first ?? 'Justice'
  });

  for (const artist of rest) {
    await page.getByRole('button', { name: 'Add to this night' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Artist').fill(artist);
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText(artist)).toBeVisible();
  }
};

test('future night attend-all marks Going, later add unset, clear stays unset', async ({ authenticatedPage }) => {
  await createNightWithArtists(authenticatedPage, {
    name: 'Club Night',
    date: '2026-12-01',
    place: 'Berlin',
    artists: ['Justice', 'Fontaines D.C.']
  });

  const attend = authenticatedPage.getByRole('button', { name: 'Attend this night' });
  await expect(attend).toBeVisible();
  await expect(chipFor(authenticatedPage, 'Justice')).toHaveAttribute('aria-pressed', 'false');
  await expect(chipFor(authenticatedPage, 'Fontaines D.C.')).toHaveAttribute('aria-pressed', 'false');

  await attend.click();
  await expect(chipFor(authenticatedPage, 'Justice')).toHaveAttribute('aria-pressed', 'true');
  await expect(chipFor(authenticatedPage, 'Justice')).toHaveText('Going');
  await expect(chipFor(authenticatedPage, 'Fontaines D.C.')).toHaveAttribute('aria-pressed', 'true');
  await expect(chipFor(authenticatedPage, 'Fontaines D.C.')).toHaveText('Going');

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Aphex Twin');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByText('Aphex Twin')).toBeVisible();
  await expect(chipFor(authenticatedPage, 'Aphex Twin')).toHaveAttribute('aria-pressed', 'false');
  await expect(chipFor(authenticatedPage, 'Justice')).toHaveAttribute('aria-pressed', 'true');
  await expect(chipFor(authenticatedPage, 'Fontaines D.C.')).toHaveAttribute('aria-pressed', 'true');

  await chipFor(authenticatedPage, 'Justice').click();
  await expect(chipFor(authenticatedPage, 'Justice')).toHaveAttribute('aria-pressed', 'false');
  await expect(chipFor(authenticatedPage, 'Fontaines D.C.')).toHaveAttribute('aria-pressed', 'true');
  await expect(authenticatedPage.getByText('Justice')).toBeVisible();
});

test('past night attend-all marks Attended', async ({ authenticatedPage }) => {
  await createNightWithArtists(authenticatedPage, {
    name: 'Past Night',
    date: '2026-08-18',
    place: 'Lyon',
    artists: ['Justice', 'Fontaines D.C.']
  });

  await authenticatedPage.getByRole('button', { name: 'Attend this night' }).click();
  await expect(chipFor(authenticatedPage, 'Justice')).toHaveAttribute('aria-pressed', 'true');
  await expect(chipFor(authenticatedPage, 'Justice')).toHaveText('Attended');
  await expect(chipFor(authenticatedPage, 'Fontaines D.C.')).toHaveAttribute('aria-pressed', 'true');
  await expect(chipFor(authenticatedPage, 'Fontaines D.C.')).toHaveText('Attended');
});

test('festival Event hides Attend this night', async ({ authenticatedPage, account }) => {
  const created = await createOwnedEventRest(account, {
    kind: 'festival',
    name: 'Rock Week',
    start: '2026-08-20',
    end: '2026-08-22',
    place: 'Paris'
  });
  await authenticatedPage.goto(created.path);
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);

  await expect(authenticatedPage.getByRole('button', { name: 'Attend this night' })).toHaveCount(0);

  await authenticatedPage.getByRole('button', { name: 'Add to this festival' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByRole('button', { name: '2026-08-20' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByText('Justice')).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: 'Attend this night' })).toHaveCount(0);
  await expect(authenticatedPage.getByRole('button', { name: 'Add to this festival' })).toBeVisible();
});
