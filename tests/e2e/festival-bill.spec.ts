import { test, expect } from './fixtures/auth.fixture';
import { concertsRest } from './helpers/concert-rest';
import { openAddSheetFromNav, gotoConcertsPeriod } from './helpers/add-concert-sheet';
import { signInRest } from './helpers/owned-event-rest';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

test('shows a festival date range and collapses one bill day', async ({ authenticatedPage, account }) => {
  const session = await signInRest(account);
  const festival = await fetch(`${session.supabaseUrl}/rest/v1/events`, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({
      kind: 'festival',
      name: 'Harbour Week',
      start_date: '2026-12-19',
      end_date: '2026-12-22',
      place: 'Bristol'
    })
  });
  expect(festival.ok).toBe(true);
  const festivalId = ((await festival.json()) as { id: string }[])[0]?.id;
  expect(festivalId).toBeTruthy();

  const oneDay = await fetch(`${session.supabaseUrl}/rest/v1/events`, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({
      kind: 'festival',
      name: 'One Day Fest',
      start_date: '2026-12-20',
      end_date: '2026-12-21',
      place: 'Bristol'
    })
  });
  expect(oneDay.ok).toBe(true);
  const oneDayId = ((await oneDay.json()) as { id: string }[])[0]?.id;
  expect(oneDayId).toBeTruthy();

  const night = await fetch(`${session.supabaseUrl}/rest/v1/events`, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({
      kind: 'single_night',
      name: 'Lantern Night',
      start_date: '2026-12-19',
      end_date: '2026-12-19',
      place: 'Bristol'
    })
  });
  expect(night.ok).toBe(true);
  const nightId = ((await night.json()) as { id: string }[])[0]?.id;
  expect(nightId).toBeTruthy();

  for (const concert of [
    { event_id: festivalId, artist: 'North Lantern', date: '2026-12-19', place: 'Bristol' },
    { event_id: festivalId, artist: 'South Harbour', date: '2026-12-22', place: 'Bristol' },
    { event_id: nightId, artist: 'The Lanterns', date: '2026-12-19', place: 'Bristol' },
    { event_id: oneDayId, artist: 'Solo Stage', date: '2026-12-20', place: 'Bristol' }
  ]) {
    const created = await fetch(concertsRest(session.supabaseUrl), {
      method: 'POST',
      headers: session.headers,
      body: JSON.stringify(concert)
    });
    expect(created.ok, await created.text()).toBe(true);
  }

  await authenticatedPage.goto(`/e/${festivalId}`);
  await waitForNuxtHydration(authenticatedPage);

  const badge = authenticatedPage.locator('header .lm-date-stack');
  await expect(badge).toHaveAttribute('data-range', 'true');
  await expect(badge.locator('.lm-date-stack-day')).toHaveText('19–22');
  await expect(badge.locator('.lm-date-stack-month')).toHaveText('DEC');
  await expect(badge.locator('.lm-date-stack-weekday')).toHaveCount(0);
  await expect(authenticatedPage.locator('header')).toContainText('19/12/2026 – 22/12/2026');

  const firstDay = authenticatedPage.getByRole('button', { name: /19 Dec/ });
  const secondDay = authenticatedPage.getByRole('button', { name: /22 Dec/ });
  await expect(firstDay).toHaveAttribute('aria-expanded', 'true');
  await expect(secondDay).toHaveAttribute('aria-expanded', 'true');
  await expect(firstDay).toContainText('1 concert');
  await firstDay.click();
  await expect(firstDay).toHaveAttribute('aria-expanded', 'false');
  const firstPanel = authenticatedPage.locator(`[id="${await firstDay.getAttribute('aria-controls')}"]`);
  await expect(firstPanel).toBeHidden();
  await expect(authenticatedPage.getByText('North Lantern')).toBeHidden();
  await expect(authenticatedPage.getByText('South Harbour')).toBeVisible();
  await expect(secondDay).toHaveAttribute('aria-expanded', 'true');
  await firstDay.click();
  await expect(firstDay).toHaveAttribute('aria-expanded', 'true');
  await expect(authenticatedPage.getByText('North Lantern')).toBeVisible();

  await authenticatedPage.goto(`/e/${oneDayId}`);
  await waitForNuxtHydration(authenticatedPage);
  await expect(authenticatedPage.getByText('Solo Stage')).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: /20 Dec/ })).toHaveCount(0);
  await expect(authenticatedPage.locator('header .lm-date-stack-day')).toHaveText('20–21');

  await authenticatedPage.goto(`/e/${nightId}`);
  await waitForNuxtHydration(authenticatedPage);
  await expect(authenticatedPage.locator('header .lm-date-stack')).not.toHaveAttribute('data-range', 'true');
  await expect(authenticatedPage.locator('header .lm-date-stack-weekday')).toHaveText('SAT');
  await expect(authenticatedPage.getByRole('button', { name: /Dec/ })).toHaveCount(0);

  await gotoConcertsPeriod(authenticatedPage, 'upcoming');
  const card = authenticatedPage.locator('[data-event-card="group"]', { hasText: 'Harbour Week' });
  await expect(card.locator('.lm-date-stack')).toHaveAttribute('data-range', 'true');
  await expect(card.locator('.lm-date-stack-day')).toHaveText('19–22');
  await expect(card.getByTestId('event-card-date')).toHaveText('19/12/2026 – 22/12/2026');
});

test('Save spans the Add sheet on a phone and Stage or Scene stays optional', async ({ authenticatedPage }) => {
  await authenticatedPage.setViewportSize({ width: 390, height: 844 });
  const sheet = await openAddSheetFromNav(authenticatedPage);
  await expect(sheet.getByText('Optional')).toBeVisible();
  const save = sheet.getByRole('button', { name: 'Save' });
  const sheetBox = await sheet.boundingBox();
  const saveBox = await save.boundingBox();
  expect(sheetBox).toBeTruthy();
  expect(saveBox).toBeTruthy();
  expect(saveBox!.width).toBeGreaterThan((sheetBox!.width) - 48);
});
