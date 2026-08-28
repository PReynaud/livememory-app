import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const addSheetEventControl = (sheet: Locator) => sheet.locator('#add-concert-event');

export const addSheetArtist = (sheet: Locator, label = 'Artist') => {
  return sheet.getByRole('combobox', { name: label });
};

export const addSheetPlace = (sheet: Locator) => sheet.getByRole('combobox', { name: 'Place' });

export const selectAddSheetEvent = async (page: Page, sheet: Locator, option: string) => {
  await addSheetEventControl(sheet).click();
  await page.getByRole('option', { name: option }).click();
};

export const openAddSheetFromNav = async (page: Page) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Add concert' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  return sheet;
};

export const createNightFromAddSheet = async (
  page: Page,
  input: { name: string; date: string; place: string; artist: string }
) => {
  const sheet = await openAddSheetFromNav(page);
  await selectAddSheetEvent(page, sheet, 'New night');
  await sheet.getByLabel('Artist').fill(input.artist);
  await sheet.getByLabel('Name').fill(input.name);
  await sheet.getByLabel('Date').fill(input.date);
  await addSheetPlace(sheet).fill(input.place);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  await expect(page.getByText(input.artist)).toBeVisible();
  return new URL(page.url()).pathname;
};

export const selectConcertsPeriodTab = async (page: Page, tab: 'upcoming' | 'past') => {
  const label = tab === 'past' ? /Souvenirs/ : /Coming up/;
  await page.getByRole('tab', { name: label }).click();
};

export const gotoConcertsPeriod = async (page: Page, tab: 'upcoming' | 'past' = 'upcoming') => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Concerts' }).click();
  await expect(page).toHaveURL(/\/concerts/);
  await selectConcertsPeriodTab(page, tab);
};

export const createFestivalFromAddSheet = async (
  page: Page,
  input: { name: string; start: string; end: string; place: string; artist: string; date: string }
) => {
  const sheet = await openAddSheetFromNav(page);
  await selectAddSheetEvent(page, sheet, 'New festival');
  await sheet.getByLabel('Artist').fill(input.artist);
  await sheet.getByLabel('Name').fill(input.name);
  await sheet.getByLabel('Start date').fill(input.start);
  await sheet.getByLabel('End date').fill(input.end);
  await addSheetPlace(sheet).fill(input.place);
  await expect(sheet.getByRole('button', { name: input.date })).toBeVisible();
  await sheet.getByRole('button', { name: input.date }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  await expect(page.getByText(input.artist)).toBeVisible();
  return new URL(page.url()).pathname;
};
