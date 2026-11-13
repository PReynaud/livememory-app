import { test, expect, type Page } from '@playwright/test';
import { createE2EAccountForTest, deleteE2EAccountForTest, type E2EAccount } from './helpers/e2e-account';
import { concertNotesRest, concertsRest } from './helpers/concert-rest';
import { signInRest } from './helpers/owned-event-rest';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

type RestSession = Awaited<ReturnType<typeof signInRest>>;

const postJson = async <T>(session: RestSession, url: string, body: unknown): Promise<T> => {
  const response = await fetch(url, { method: 'POST', headers: session.headers, body: JSON.stringify(body) });
  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${await response.text()}`);
  }

  return await response.json() as T;
};

const addConcertWithNote = async (
  session: RestSession,
  input: { eventId: string; artist: string; date: string; place: string; notes?: string }
) => {
  const rows = await postJson<{ id: string }[]>(session, concertsRest(session.supabaseUrl), {
    event_id: input.eventId,
    artist: input.artist,
    date: input.date,
    place: input.place
  });
  const concertId = rows[0]!.id;
  if (input.notes) {
    const patch = await fetch(concertNotesRest(session.supabaseUrl, `concert_id=eq.${concertId}`), {
      method: 'PATCH',
      headers: session.headers,
      body: JSON.stringify({ notes: input.notes })
    });
    expect(patch.ok).toBe(true);
  }
};

const signInOnPage = async (page: Page, account: E2EAccount) => {
  await page.goto('/login');
  await waitForNuxtHydration(page);
  const form = page.locator('form').first();
  await form.getByLabel('Email').fill(account.email);
  await form.locator('input[name="password"]').fill(account.password);
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/home/);
};

test('shows owner notes on the Event page and hides them from a joiner', async ({ browser }, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-notes-owner-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`${testInfo.project.name}-notes-joiner-${testInfo.retry}`);

  try {
    const session = await signInRest(owner);
    const night = await postJson<{ id: string }[]>(session, `${session.supabaseUrl}/rest/v1/events`, {
      kind: 'single_night',
      name: 'Notes Night',
      start_date: '2026-12-20',
      end_date: '2026-12-20',
      place: 'Lyon'
    });
    const nightId = night[0]!.id;
    await addConcertWithNote(session, {
      eventId: nightId,
      artist: 'The Lanterns',
      date: '2026-12-20',
      place: 'Lyon',
      notes: 'Front row, bring earplugs.'
    });

    const festival = await postJson<{ id: string }[]>(session, `${session.supabaseUrl}/rest/v1/events`, {
      kind: 'festival',
      name: 'Notes Festival',
      start_date: '2026-12-21',
      end_date: '2026-12-22',
      place: 'Nantes'
    });
    const festivalId = festival[0]!.id;
    await addConcertWithNote(session, {
      eventId: festivalId,
      artist: 'Aurora Fields',
      date: '2026-12-21',
      place: 'Nantes',
      notes: 'Main stage at seven.'
    });
    await addConcertWithNote(session, { eventId: festivalId, artist: 'Glass Harbour', date: '2026-12-22', place: 'Nantes' });

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signInOnPage(ownerPage, owner);

    await ownerPage.goto(`/e/${nightId}`);
    await waitForNuxtHydration(ownerPage);
    const notes = ownerPage.getByTestId('event-notes');
    await expect(notes.getByRole('heading', { name: 'My notes' })).toBeVisible();
    await expect(notes).toContainText('Front row, bring earplugs.');
    await expect(ownerPage.locator('header .lm-date-stack')).toBeVisible();
    await expect(ownerPage.locator('header').getByRole('button', { name: /Mark as (going|attended)/ })).toBeVisible();

    await ownerPage.goto(`/e/${festivalId}`);
    await waitForNuxtHydration(ownerPage);
    await expect(ownerPage.getByTestId('event-notes')).toHaveCount(0);
    await expect(ownerPage.getByTestId('event-row-note')).toHaveText(['Main stage at seven.']);
    await ownerContext.close();

    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();
    await signInOnPage(joinerPage, joiner);

    for (const eventId of [nightId, festivalId]) {
      await joinerPage.goto(`/e/${eventId}`);
      await waitForNuxtHydration(joinerPage);
      await expect(joinerPage.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(joinerPage.getByTestId('event-notes')).toHaveCount(0);
      await expect(joinerPage.getByTestId('event-row-note')).toHaveCount(0);
      await expect(joinerPage.getByText(/Front row|Main stage at seven/)).toHaveCount(0);
    }
    await joinerContext.close();
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});
