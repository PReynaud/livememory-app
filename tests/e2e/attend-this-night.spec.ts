import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';

const goingChipOnConcerts = (page: Page) => {
  return page.locator('[data-event-card="group"]').getByRole('button', { name: /Mark as (going|attended)/ });
};

const createNightWithArtists = async (
  page: Page,
  input: { name: string; date: string; place: string; artists: string[] }
) => {
  await page.getByRole('link', { name: 'Concerts' }).click();
  await page.getByRole('button', { name: 'New night' }).click();
  await page.getByLabel('Name').fill(input.name);
  await page.getByLabel('Date').fill(input.date);
  await page.getByLabel('City').fill(input.place);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);

  for (const artist of input.artists) {
    await page.getByRole('button', { name: 'Add to this night' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Artist').fill(artist);
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText(artist)).toBeVisible();
  }
};

test('future night attend-all marks Going, later add inherits, clear stays unset', async ({ authenticatedPage }) => {
  await createNightWithArtists(authenticatedPage, {
    name: 'Club Night',
    date: '2026-12-01',
    place: 'Berlin',
    artists: ['Justice', 'Fontaines D.C.']
  });

  const attend = authenticatedPage.getByRole('button', { name: 'Attend this night' });
  await expect(attend).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(0);

  await attend.click();

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  const group = authenticatedPage.locator('[data-event-card="group"]');
  await expect(group.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(1);
  await expect(goingChipOnConcerts(authenticatedPage)).toHaveAttribute('aria-pressed', 'true');
  await expect(goingChipOnConcerts(authenticatedPage)).toHaveText('Going');

  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home', exact: true }).click();
  const featuredGroup = authenticatedPage.getByTestId('home-featured').locator('[data-event-card="group"]');
  await expect(featuredGroup.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(1);
  await expect(featuredGroup.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveAttribute('aria-pressed', 'true');

  await featuredGroup.getByRole('link').click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await sheet.getByLabel('Artist').fill('Aphex Twin');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(authenticatedPage.getByText('Aphex Twin')).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(0);

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await expect(goingChipOnConcerts(authenticatedPage)).toHaveCount(1);
  await expect(goingChipOnConcerts(authenticatedPage)).toHaveAttribute('aria-pressed', 'true');

  await goingChipOnConcerts(authenticatedPage).click();
  await expect(goingChipOnConcerts(authenticatedPage)).toHaveAttribute('aria-pressed', 'false');
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
  await expect(authenticatedPage.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(0);

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await expect(goingChipOnConcerts(authenticatedPage)).toHaveAttribute('aria-pressed', 'true');
  await expect(goingChipOnConcerts(authenticatedPage)).toHaveText('Attended');
});

test('festival Event hides Attend this night', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New festival' }).click();
  await authenticatedPage.getByLabel('Name').fill('Rock Week');
  await authenticatedPage.getByLabel('Start date').fill('2026-08-20');
  await authenticatedPage.getByLabel('End date').fill('2026-08-22');
  await authenticatedPage.getByLabel('City').fill('Paris');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
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
  await expect(authenticatedPage.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(1);
  await expect(authenticatedPage.getByRole('button', { name: 'Add to this festival' })).toBeVisible();
});
