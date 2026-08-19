import { expect, test } from './fixtures/auth.fixture';

test('shows empty Home and Concerts copy; Add concert opens the sheet', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(authenticatedPage.getByText('Nothing upcoming.')).toBeVisible();
  await expect(authenticatedPage.getByText('Add a night or a concert.')).toBeVisible();
  await expect(authenticatedPage.getByText('Attended')).toBeVisible();
  await expect(authenticatedPage.getByText('0').first()).toBeVisible();

  await authenticatedPage.locator('main').getByRole('button', { name: 'Add concert' }).click();
  await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
  await expect(authenticatedPage.getByRole('heading', { name: 'Add concert' })).toBeVisible();
  await authenticatedPage.keyboard.press('Escape');
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expect(authenticatedPage).toHaveURL(/\/home/);

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await expect(authenticatedPage).toHaveURL(/\/concerts/);
  await expect(authenticatedPage.getByText('No shows yet.')).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: 'New night' })).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: 'New festival' })).toBeVisible();

  await authenticatedPage.locator('main').getByRole('button', { name: 'Add concert' }).click();
  await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
  await expect(authenticatedPage.getByRole('heading', { name: 'Add concert' })).toBeVisible();
  await authenticatedPage.keyboard.press('Escape');
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expect(authenticatedPage).toHaveURL(/\/concerts/);

  await authenticatedPage.getByRole('button', { name: 'New night' }).click();
  await expect(authenticatedPage.getByLabel('Name')).toBeVisible();
  await expect(authenticatedPage.getByLabel('Date')).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: 'Save' })).toBeVisible();
});
