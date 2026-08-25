import type { Locator, Page } from '@playwright/test';

export const addSheetEventControl = (sheet: Locator) => sheet.locator('#add-concert-event');

export const addSheetArtist = (sheet: Locator, label = 'Artist') => {
  return sheet.getByRole('combobox', { name: label });
};

export const addSheetPlace = (sheet: Locator) => sheet.getByRole('combobox', { name: 'Place' });

export const selectAddSheetEvent = async (page: Page, sheet: Locator, option: string) => {
  await addSheetEventControl(sheet).click();
  await page.getByRole('option', { name: option }).click();
};
