import { test, expect } from '@playwright/test';
import { createE2EAccountForTest, deleteE2EAccountForTest } from './helpers/e2e-account';
import { concertsRest } from './helpers/concert-rest';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';
import type { E2EAccount } from './helpers/e2e-account';
import { JOINER_IMPACT_COPY } from '../../shared/domain/membership';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

const parisToday = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

const addUtcDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const signInRest = async (account: Pick<E2EAccount, 'email' | 'password'>) => {
  const supabaseUrl = (process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || LOCAL_SUPABASE_ANON_KEY;
  const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: account.email, password: account.password })
  });
  expect(sessionResponse.ok).toBe(true);
  const session = await sessionResponse.json() as { access_token: string };
  return { supabaseUrl, headers: restHeaders(session.access_token, anonKey) };
};

const postJson = async <T>(url: string, headers: ReturnType<typeof restHeaders>, body: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${await response.text()}`);
  }
  return await response.json() as T;
};

const rpcJson = async <T>(
  session: { supabaseUrl: string; headers: ReturnType<typeof restHeaders> },
  fn: string,
  args: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: T }> => {
  const response = await fetch(`${session.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify(args)
  });
  return {
    ok: response.ok,
    status: response.status,
    data: await response.json() as T
  };
};

const signInOnPage = async (
  page: import('@playwright/test').Page,
  account: Pick<E2EAccount, 'email' | 'password'>
) => {
  await waitForNuxtHydration(page);
  const form = page.locator('form').first();
  await form.getByLabel('Email').fill(account.email);
  await form.locator('input[name="password"]').fill(account.password);
  await form.getByRole('button', { name: 'Sign in' }).click();
};

const createNight = async (
  session: { supabaseUrl: string; headers: ReturnType<typeof restHeaders> },
  input: { name: string; date: string; place: string }
) => {
  const events = await postJson<{ id: string }[]>(`${session.supabaseUrl}/rest/v1/events`, session.headers, {
    kind: 'single_night',
    name: input.name,
    start_date: input.date,
    end_date: input.date,
    place: input.place
  });
  const eventId = events[0]?.id;
  expect(eventId).toBeTruthy();
  return eventId!;
};

const addConcert = async (
  session: { supabaseUrl: string; headers: ReturnType<typeof restHeaders> },
  input: { eventId: string; artist: string; date: string; place: string }
) => {
  const concerts = await postJson<{ id: string }[]>(concertsRest(session.supabaseUrl), session.headers, {
    event_id: input.eventId,
    artist: input.artist,
    date: input.date,
    place: input.place
  });
  const concertId = concerts[0]?.id;
  expect(concertId).toBeTruthy();
  return concertId!;
};

test('owner-only boolean RPCs do not leak joiner identities', async ({ page: _page }, testInfo) => {
  const owner = await createE2EAccountForTest(`impact-rpc-own-${testInfo.workerIndex}-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`impact-rpc-join-${testInfo.workerIndex}-${testInfo.retry}`);
  const other = await createE2EAccountForTest(`impact-rpc-other-${testInfo.workerIndex}-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const date = addUtcDays(parisToday(), 9);
    const sourceId = await createNight(ownerSession, { name: 'Source Night', date, place: 'Paris' });
    const targetId = await createNight(ownerSession, { name: 'Target Night', date, place: 'Paris' });
    const otherId = await createNight(ownerSession, { name: 'Other Night', date, place: 'Paris' });

    const empty = await rpcJson<boolean>(ownerSession, 'event_has_joiners', { p_event_id: sourceId });
    expect(empty.ok).toBe(true);
    expect(empty.data).toBe(false);

    const joinerSession = await signInRest(joiner);
    await postJson(`${joinerSession.supabaseUrl}/rest/v1/event_members`, joinerSession.headers, {
      event_id: sourceId
    });

    const ownerMembers = await fetch(
      `${ownerSession.supabaseUrl}/rest/v1/event_members?event_id=eq.${sourceId}&select=user_id,id`,
      { headers: ownerSession.headers }
    );
    expect(await ownerMembers.json()).toEqual([]);

    const hasJoiners = await rpcJson<boolean>(ownerSession, 'event_has_joiners', { p_event_id: sourceId });
    expect(hasJoiners.ok).toBe(true);
    expect(hasJoiners.data).toBe(true);
    expect(JSON.stringify(hasJoiners.data)).not.toMatch(joiner.userId);
    expect(JSON.stringify(hasJoiners.data)).not.toMatch(joiner.username);

    const joinerLookup = await rpcJson<boolean>(joinerSession, 'event_has_joiners', { p_event_id: sourceId });
    expect(joinerLookup.ok).toBe(true);
    expect(joinerLookup.data).toBe(false);

    const moveImpact = await rpcJson<boolean>(ownerSession, 'concert_move_would_lose_joiners', {
      p_source_event_id: sourceId,
      p_target_event_id: targetId
    });
    expect(moveImpact.ok).toBe(true);
    expect(moveImpact.data).toBe(true);

    await postJson(`${joinerSession.supabaseUrl}/rest/v1/event_members`, joinerSession.headers, {
      event_id: targetId
    });
    const alreadyOnTarget = await rpcJson<boolean>(ownerSession, 'concert_move_would_lose_joiners', {
      p_source_event_id: sourceId,
      p_target_event_id: targetId
    });
    expect(alreadyOnTarget.data).toBe(false);

    const otherSession = await signInRest(other);
    const stranger = await rpcJson<boolean>(otherSession, 'event_has_joiners', { p_event_id: sourceId });
    expect(stranger.data).toBe(false);

    const unusedTarget = await rpcJson<boolean>(ownerSession, 'concert_move_would_lose_joiners', {
      p_source_event_id: sourceId,
      p_target_event_id: otherId
    });
    expect(unusedTarget.data).toBe(true);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
    await deleteE2EAccountForTest(other.userId);
  }
});

test('owner confirms Concert delete when a joiner would lose it', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`impact-del-own-${testInfo.workerIndex}-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`impact-del-join-${testInfo.workerIndex}-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const date = addUtcDays(parisToday(), 10);
    const eventId = await createNight(ownerSession, { name: 'Delete Concert Night', date, place: 'Lyon' });
    const concertId = await addConcert(ownerSession, {
      eventId,
      artist: 'Justice',
      date,
      place: 'Lyon'
    });

    const joinerSession = await signInRest(joiner);
    await postJson(`${joinerSession.supabaseUrl}/rest/v1/event_members`, joinerSession.headers, {
      event_id: eventId
    });
    await postJson(`${joinerSession.supabaseUrl}/rest/v1/attendance`, joinerSession.headers, {
      concert_id: concertId,
      status: 'going'
    });

    await page.goto('/login');
    await signInOnPage(page, owner);
    await expect(page).toHaveURL(/\/home/);
    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Delete Concert Night' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Justice' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Edit concert' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(sheet.getByText(JOINER_IMPACT_COPY.deleteConcert)).toBeVisible();
    await expect(sheet.getByText('Delete this concert?')).toHaveCount(0);
    await expect(sheet.getByText(joiner.username)).toHaveCount(0);

    await sheet.getByRole('button', { name: 'Delete concert' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText('No concerts on this bill.')).toBeVisible();

    const joinerConcerts = await fetch(
      concertsRest(joinerSession.supabaseUrl, `id=eq.${concertId}`),
      { headers: joinerSession.headers }
    );
    expect(await joinerConcerts.json()).toEqual([]);

    const joinerAttendance = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/attendance?concert_id=eq.${concertId}&select=id`,
      { headers: joinerSession.headers }
    );
    expect(await joinerAttendance.json()).toEqual([]);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});

test('owner confirms Concert move when source joiners would lose the Bill', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`impact-mv-own-${testInfo.workerIndex}-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`impact-mv-join-${testInfo.workerIndex}-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const date = addUtcDays(parisToday(), 11);
    const sourceId = await createNight(ownerSession, { name: 'Move Source', date, place: 'Berlin' });
    const targetId = await createNight(ownerSession, { name: 'Move Target', date, place: 'Berlin' });
    const concertId = await addConcert(ownerSession, {
      eventId: sourceId,
      artist: 'Justice',
      date,
      place: 'Berlin'
    });

    const joinerSession = await signInRest(joiner);
    await postJson(`${joinerSession.supabaseUrl}/rest/v1/event_members`, joinerSession.headers, {
      event_id: sourceId
    });

    await page.goto('/login');
    await signInOnPage(page, owner);
    await expect(page).toHaveURL(/\/home/);
    await page.goto(`/e/${sourceId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Move Source' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Justice' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Edit concert' })).toBeVisible();
    await sheet.getByLabel('Event').click();
    await page.getByRole('option', { name: 'Move Target' }).click();
    await expect(sheet.getByText(JOINER_IMPACT_COPY.moveConcert)).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet.getByText(JOINER_IMPACT_COPY.moveConcert)).toBeVisible();
    await expect(sheet.getByText(joiner.username)).toHaveCount(0);

    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet.getByText(JOINER_IMPACT_COPY.moveConcert)).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet.getByText(JOINER_IMPACT_COPY.moveConcert)).toBeVisible();
    await sheet.getByRole('button', { name: 'Move concert' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/e/${targetId}$`));
    await expect(page.getByRole('heading', { name: 'Move Target' })).toBeVisible();
    await expect(page.getByText('Justice')).toBeVisible();

    const targetMembers = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/event_members?event_id=eq.${targetId}&select=user_id`,
      { headers: joinerSession.headers }
    );
    expect(await targetMembers.json()).toEqual([]);

    const joinerConcert = await fetch(
      concertsRest(joinerSession.supabaseUrl, `id=eq.${concertId}`),
      { headers: joinerSession.headers }
    );
    expect(await joinerConcert.json()).toEqual([]);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});

test('owner confirms Event delete when joiners would lose it', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`impact-ev-own-${testInfo.workerIndex}-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`impact-ev-join-${testInfo.workerIndex}-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const date = addUtcDays(parisToday(), 12);
    const eventId = await createNight(ownerSession, { name: 'Delete Event Night', date, place: 'Nantes' });
    const concertId = await addConcert(ownerSession, {
      eventId,
      artist: 'Justice',
      date,
      place: 'Nantes'
    });

    const joinerSession = await signInRest(joiner);
    await postJson(`${joinerSession.supabaseUrl}/rest/v1/event_members`, joinerSession.headers, {
      event_id: eventId
    });
    await postJson(`${joinerSession.supabaseUrl}/rest/v1/attendance`, joinerSession.headers, {
      concert_id: concertId,
      status: 'going'
    });

    await page.goto('/login');
    await signInOnPage(page, owner);
    await expect(page).toHaveURL(/\/home/);
    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);

    await page.getByRole('button', { name: 'Edit event' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(sheet.getByText(JOINER_IMPACT_COPY.deleteEvent)).toBeVisible();
    await expect(sheet.getByText('This Event and all its Concerts will be deleted.')).toHaveCount(0);
    await expect(sheet.getByText(joiner.username)).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Delete event' }).click();
    await expect(page).toHaveURL(/\/concerts/);

    const joinerEvents = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/events?id=eq.${eventId}&select=id`,
      { headers: joinerSession.headers }
    );
    expect(await joinerEvents.json()).toEqual([]);

    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/profile/);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await signInOnPage(page, joiner);
    await expect(page).toHaveURL(/\/home/);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByTestId('home-featured-empty')).toBeVisible();
    await expect(page.getByText('Delete Event Night')).toHaveCount(0);

    await page.getByRole('link', { name: 'Concerts' }).click();
    await expect(page).toHaveURL(/\/concerts/);
    await waitForNuxtHydration(page);
    await expect(page.getByText('Delete Event Night')).toHaveCount(0);
    await expect(page.getByText('Justice')).toHaveCount(0);

    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Event not found.' })).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});

test('empty Event with joiners still confirms without a Concert warning', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`impact-empty-own-${testInfo.workerIndex}-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`impact-empty-join-${testInfo.workerIndex}-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner);
    const date = addUtcDays(parisToday(), 13);
    const eventId = await createNight(ownerSession, { name: 'Empty Joiner Night', date, place: 'Lille' });

    const joinerSession = await signInRest(joiner);
    await postJson(`${joinerSession.supabaseUrl}/rest/v1/event_members`, joinerSession.headers, {
      event_id: eventId
    });

    await page.goto('/login');
    await signInOnPage(page, owner);
    await expect(page).toHaveURL(/\/home/);
    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);

    await page.getByRole('button', { name: 'Edit event' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(sheet.getByText(JOINER_IMPACT_COPY.deleteEmptyEvent)).toBeVisible();
    await expect(sheet.getByText('This Event and all its Concerts will be deleted.')).toHaveCount(0);
    await expect(sheet.getByText(/Concerts/)).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Delete event' }).click();
    await expect(page).toHaveURL(/\/concerts/);

    const stillJoined = await fetch(
      `${joinerSession.supabaseUrl}/rest/v1/event_members?event_id=eq.${eventId}&select=user_id`,
      { headers: joinerSession.headers }
    );
    expect(await stillJoined.json()).toEqual([]);

    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Event not found.' })).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});
