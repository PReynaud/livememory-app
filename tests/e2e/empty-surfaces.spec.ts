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
  await expect(authenticatedPage.getByText('Nothing upcoming right now.')).toBeVisible();
  await expect(authenticatedPage.getByRole('tab', { name: /Coming up/ })).toBeVisible();
  await expect(authenticatedPage.getByRole('tab', { name: /Souvenirs/ })).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: 'New night' })).toHaveCount(0);
  await expect(authenticatedPage.getByRole('button', { name: 'New festival' })).toHaveCount(0);
  await expect(authenticatedPage.getByTestId('concert-filter-open')).toBeVisible();

  await authenticatedPage.getByTestId('concert-filter-open').click();
  await expect(authenticatedPage.getByRole('dialog').getByRole('heading', { name: 'Filter' })).toBeVisible();
  await authenticatedPage.getByRole('button', { name: 'Apply' }).click();
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);

  await authenticatedPage.locator('main').getByRole('button', { name: 'Add concert' }).click();
  await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
  await expect(authenticatedPage.getByRole('heading', { name: 'Add concert' })).toBeVisible();
  await authenticatedPage.keyboard.press('Escape');
  await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0);
  await expect(authenticatedPage).toHaveURL(/\/concerts/);
});
