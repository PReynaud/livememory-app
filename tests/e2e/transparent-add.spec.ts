import { test, expect } from './fixtures/auth.fixture';
import { selectAddSheetEvent } from './helpers/add-concert-sheet';

test('logs a past one-performer show from nav Add without picking an Event', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Add concert' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Add concert' })).toBeVisible();
  await selectAddSheetEvent(authenticatedPage, sheet, 'New night');

  await sheet.getByLabel('Artist').fill('Justice');
  await sheet.getByLabel('Date').fill('2026-08-10');
  await expect(sheet.getByLabel('Date')).toHaveValue('2026-08-10');
  await sheet.getByLabel('City').fill('Berlin');
  await sheet.getByLabel('Time').fill('20:15');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(authenticatedPage.getByText('Concert added.', { exact: true })).toBeVisible();
  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Concerts', exact: true }).click();

  const compact = authenticatedPage.locator('[data-event-card="compact"]');
  await expect(compact).toBeVisible();
  await expect(compact.getByRole('link')).toContainText('Justice');
  await expect(compact.getByText('10/08/2026 · Berlin · 20:15')).toBeVisible();
  await expect(compact.getByText('Concerts on 10/08/2026 at Berlin')).toBeVisible();
  await expect(authenticatedPage.locator('[data-event-card="group"]')).toHaveCount(0);

  const chip = compact.getByRole('button', { name: 'Mark as attended' });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(chip).toHaveText('Attended');
  await expect(chip).toBeEnabled();

  await chip.click();
  await expect(authenticatedPage).toHaveURL(/\/concerts/);
  await expect(chip).toHaveAttribute('aria-pressed', 'false');

  await compact.getByRole('link').click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  await expect(authenticatedPage.getByRole('heading', { name: 'Concerts on 10/08/2026 at Berlin' })).toBeVisible();
  await expect(authenticatedPage.getByText('Justice')).toBeVisible();
});

test('defaults future transparent Attendance to Going and groups after a second Concert', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Add concert' }).click();
  const sheet = authenticatedPage.getByRole('dialog');
  await selectAddSheetEvent(authenticatedPage, sheet, 'New night');
  await sheet.getByLabel('Artist').fill('Fontaines D.C.');
  await sheet.getByLabel('Date').fill('2026-12-01');
  await sheet.getByLabel('City').fill('Lyon');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage.getByText('Concert added.', { exact: true })).toBeVisible();

  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Concerts', exact: true }).click();
  const compact = authenticatedPage.locator('[data-event-card="compact"]');
  await expect(compact).toBeVisible();
  await expect(compact.getByRole('button', { name: 'Mark as going' })).toHaveAttribute('aria-pressed', 'true');
  await expect(compact.getByRole('button', { name: 'Mark as going' })).toHaveText('Going');

  await compact.getByRole('link').click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const again = authenticatedPage.getByRole('dialog');
  await again.getByLabel('Artist').fill('Local Band');
  await again.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage.getByText('Concert added.', { exact: true })).toBeVisible();

  await expect(authenticatedPage.getByText('Fontaines D.C.')).toBeVisible();
  await expect(authenticatedPage.getByText('Local Band')).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(0);
  await expect(authenticatedPage.getByRole('button', { name: 'Attend this night' })).toBeVisible();

  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Concerts', exact: true }).click();
  const group = authenticatedPage.locator('[data-event-card="group"]');
  await expect(group).toBeVisible();
  await expect(authenticatedPage.locator('[data-event-card="compact"]')).toHaveCount(0);
  await expect(group.getByText('Concerts on 01/12/2026 at Lyon')).toBeVisible();
  await expect(group.getByText('Fontaines D.C.')).toBeVisible();
  await expect(group.getByText('Local Band')).toBeVisible();
  await expect(group.getByRole('button', { name: 'Mark as going' })).toHaveCount(1);
  await expect(group.getByRole('button', { name: 'Mark as going' })).toHaveAttribute('aria-pressed', 'true');
});
