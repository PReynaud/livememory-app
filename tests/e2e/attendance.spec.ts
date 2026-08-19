import { test, expect } from './fixtures/auth.fixture';
import { createE2EAccountForTest, deleteE2EAccountForTest } from './helpers/e2e-account';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

const signIn = async (email: string, password: string) => {
  const supabaseUrl = (process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || LOCAL_SUPABASE_ANON_KEY;
  const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!sessionResponse.ok) {
    throw new Error(`Failed to sign in E2E account: ${await sessionResponse.text()}`);
  }

  const session = await sessionResponse.json() as { access_token: string };
  return { supabaseUrl, anonKey, headers: restHeaders(session.access_token, anonKey) };
};

const createOwnedConcert = async (
  headers: ReturnType<typeof restHeaders>,
  supabaseUrl: string,
  input: { name: string; date: string; place: string; artist: string }
) => {
  const eventResponse = await fetch(`${supabaseUrl}/rest/v1/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      kind: 'single_night',
      name: input.name,
      start_date: input.date,
      end_date: input.date,
      place: input.place
    })
  });
  if (!eventResponse.ok) {
    throw new Error(`Failed to create event: ${await eventResponse.text()}`);
  }

  const events = await eventResponse.json() as { id: string }[];
  const eventId = events[0]?.id;
  if (!eventId) {
    throw new Error('Failed to create event');
  }

  const concertResponse = await fetch(`${supabaseUrl}/rest/v1/concerts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event_id: eventId,
      artist: input.artist,
      date: input.date,
      place: input.place
    })
  });
  if (!concertResponse.ok) {
    throw new Error(`Failed to create concert: ${await concertResponse.text()}`);
  }

  const concerts = await concertResponse.json() as { id: string }[];
  const concertId = concerts[0]?.id;
  if (!concertId) {
    throw new Error('Failed to create concert');
  }

  return { eventId, concertId };
};

const isUuid = (value: string) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

const patchConcertDate = async (
  headers: ReturnType<typeof restHeaders>,
  supabaseUrl: string,
  concertId: string,
  date: string
) => {
  if (!isUuid(concertId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid concert date patch');
  }

  const concertResponse = await fetch(
    `${supabaseUrl}/rest/v1/concerts?id=eq.${concertId}&select=event_id`,
    { headers }
  );
  if (!concertResponse.ok) {
    throw new Error(`Failed to load concert for date patch: ${await concertResponse.text()}`);
  }

  const concerts = await concertResponse.json() as { event_id: string }[];
  const eventId = concerts[0]?.event_id;
  if (!eventId) {
    throw new Error('Concert for date patch was not found');
  }

  const saved = await fetch(`${supabaseUrl}/rest/v1/rpc/save_event_and_concert_dates`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_event_id: eventId,
      p_start_date: date,
      p_end_date: date,
      p_concert_dates: [{ id: concertId, date }]
    })
  });

  if (!saved.ok) {
    throw new Error(`Failed to save concert date: ${await saved.text()}`);
  }
};

test('marks a future concert Going and a past concert Attended, then clear stays unset', async ({ authenticatedPage }) => {
  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  await authenticatedPage.getByRole('button', { name: 'New night' }).click();
  await authenticatedPage.getByLabel('Name').fill('Future Night');
  await authenticatedPage.getByLabel('Date').fill('2026-12-01');
  await authenticatedPage.getByLabel('Place').fill('Lyon');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  const futureEventPath = new URL(authenticatedPage.url()).pathname;

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const futureSheet = authenticatedPage.getByRole('dialog');
  await futureSheet.getByLabel('Artist').fill('Justice');
  await futureSheet.getByRole('button', { name: 'Save' }).click();

  const goingChip = authenticatedPage.getByRole('button', { name: 'Mark as going' });
  await expect(goingChip).toHaveAttribute('aria-pressed', 'false');
  await goingChip.click();
  await expect(goingChip).toHaveAttribute('aria-pressed', 'true');
  await expect(goingChip).toHaveText('Going');

  await authenticatedPage.reload();
  await waitForNuxtHydration(authenticatedPage);
  await expect(authenticatedPage).toHaveURL(new RegExp(`${futureEventPath}$`));
  const reloadedGoing = authenticatedPage.getByRole('button', { name: 'Mark as going' });
  await expect(reloadedGoing).toHaveAttribute('aria-pressed', 'true');
  await expect(reloadedGoing).toHaveText('Going');

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  const concertsGoing = authenticatedPage.getByRole('button', { name: 'Mark as going' });
  await expect(concertsGoing).toHaveAttribute('aria-pressed', 'true');
  await expect(concertsGoing).toHaveText('Going');
  await concertsGoing.click();
  await expect(concertsGoing).toHaveAttribute('aria-pressed', 'false');

  await authenticatedPage.getByRole('button', { name: 'New night' }).click();
  await authenticatedPage.getByLabel('Name').fill('Past Night');
  await authenticatedPage.getByLabel('Date').fill('2026-08-18');
  await authenticatedPage.getByLabel('Place').fill('Berlin');
  await authenticatedPage.getByRole('button', { name: 'Save' }).click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);

  await authenticatedPage.getByRole('button', { name: 'Add to this night' }).click();
  const pastSheet = authenticatedPage.getByRole('dialog');
  await pastSheet.getByLabel('Artist').fill('Fontaines D.C.');
  await pastSheet.getByRole('button', { name: 'Save' }).click();

  const attendedChip = authenticatedPage.getByRole('button', { name: 'Mark as attended' });
  await expect(attendedChip).toHaveAttribute('aria-pressed', 'false');
  await attendedChip.click();
  await expect(attendedChip).toHaveAttribute('aria-pressed', 'true');
  await expect(attendedChip).toHaveText('Attended');

  await authenticatedPage.getByRole('link', { name: 'Concerts' }).click();
  const pastGroup = authenticatedPage.locator('section').filter({ hasText: 'Past Night' });
  const concertsAttended = pastGroup.getByRole('button', { name: 'Mark as attended' });
  await expect(concertsAttended).toHaveAttribute('aria-pressed', 'true');
  await expect(concertsAttended).toHaveText('Attended');

  await pastGroup.getByRole('link', { name: /Past Night/ }).click();
  await expect(authenticatedPage).toHaveURL(/\/e\/[0-9a-f-]{36}$/i);
  const eventAttended = authenticatedPage.getByRole('button', { name: 'Mark as attended' });
  await expect(eventAttended).toHaveAttribute('aria-pressed', 'true');
  await eventAttended.click();
  await expect(eventAttended).toHaveAttribute('aria-pressed', 'false');
  await expect(eventAttended).toHaveText('Attended');
});

test('hides another user attendance over REST and coerces past going to attended', async ({ page: _page }, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-owner-${testInfo.retry}`);
  const other = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-other-${testInfo.retry}`);

  try {
    const ownerSession = await signIn(owner.email, owner.password);
    const otherSession = await signIn(other.email, other.password);

    const future = await createOwnedConcert(ownerSession.headers, ownerSession.supabaseUrl, {
      name: 'Future Night',
      date: '2026-12-01',
      place: 'Lyon',
      artist: 'Justice'
    });
    const past = await createOwnedConcert(ownerSession.headers, ownerSession.supabaseUrl, {
      name: 'Past Night',
      date: '2026-08-18',
      place: 'Berlin',
      artist: 'Fontaines D.C.'
    });

    const futureAttended = await fetch(`${ownerSession.supabaseUrl}/rest/v1/attendance`, {
      method: 'POST',
      headers: ownerSession.headers,
      body: JSON.stringify({
        concert_id: future.concertId,
        status: 'attended'
      })
    });
    expect(futureAttended.ok).toBe(false);

    const futureGoing = await fetch(`${ownerSession.supabaseUrl}/rest/v1/attendance`, {
      method: 'POST',
      headers: ownerSession.headers,
      body: JSON.stringify({
        concert_id: future.concertId,
        status: 'going'
      })
    });
    expect(futureGoing.ok).toBe(true);
    const futureRows = await futureGoing.json() as { status: string; concert_id: string }[];
    expect(futureRows[0]?.status).toBe('going');

    await patchConcertDate(ownerSession.headers, ownerSession.supabaseUrl, future.concertId, '2026-08-18');

    const storedAfterMove = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/attendance?concert_id=eq.${future.concertId}&select=status`,
      { headers: ownerSession.headers }
    );
    expect(storedAfterMove.ok).toBe(true);
    const storedRows = await storedAfterMove.json() as { status: string }[];
    expect(storedRows[0]?.status).toBe('going');

    const effectiveAfterMove = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/attendance_effective?concert_id=eq.${future.concertId}&select=status`,
      { headers: ownerSession.headers }
    );
    expect(effectiveAfterMove.ok).toBe(true);
    const effectiveRows = await effectiveAfterMove.json() as { status: string }[];
    expect(effectiveRows[0]?.status).toBe('attended');

    const pastGoing = await fetch(`${ownerSession.supabaseUrl}/rest/v1/attendance`, {
      method: 'POST',
      headers: ownerSession.headers,
      body: JSON.stringify({
        concert_id: past.concertId,
        status: 'going'
      })
    });
    expect(pastGoing.ok).toBe(true);
    const pastRows = await pastGoing.json() as { id: string; status: string }[];
    expect(pastRows[0]?.status).toBe('attended');

    const attendedToGoing = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/attendance?id=eq.${pastRows[0]?.id}`,
      {
        method: 'PATCH',
        headers: ownerSession.headers,
        body: JSON.stringify({ status: 'going' })
      }
    );
    expect(attendedToGoing.ok).toBe(false);

    const otherListed = await fetch(`${otherSession.supabaseUrl}/rest/v1/attendance?select=*`, {
      headers: otherSession.headers
    });
    expect(otherListed.ok).toBe(true);
    expect(await otherListed.json()).toEqual([]);

    const otherEffective = await fetch(
      `${otherSession.supabaseUrl}/rest/v1/attendance_effective?select=*`,
      { headers: otherSession.headers }
    );
    expect(otherEffective.ok).toBe(true);
    expect(await otherEffective.json()).toEqual([]);

    const ownerListed = await fetch(`${ownerSession.supabaseUrl}/rest/v1/attendance?select=*`, {
      headers: ownerSession.headers
    });
    expect(ownerListed.ok).toBe(true);
    const ownerRows = await ownerListed.json() as { concert_id: string }[];
    expect(ownerRows).toHaveLength(2);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(other.userId);
  }
});
