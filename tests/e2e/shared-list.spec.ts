import { test, expect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './fixtures/auth.fixture';
import {
  createE2EAccountForTest,
  deleteE2EAccountForTest
} from './helpers/e2e-account';
import { concertNotesRest, concertsRest } from './helpers/concert-rest';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';
import { COPY_LINK_FAILED } from '../../app/utils/copy-link';
import { SHARED_LIST_EMPTY, SHARED_LIST_HELPER, SHARED_LIST_NOT_FOUND } from '../../shared/domain/shared-list';

const restHeaders = (accessToken: string, anonKey: string) => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

const signInRest = async (email: string, password: string) => {
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
  expect(sessionResponse.ok).toBe(true);
  const session = await sessionResponse.json() as { access_token: string };
  return { supabaseUrl, headers: restHeaders(session.access_token, anonKey) };
};

const addUtcDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

const enableSharing = async (
  session: { supabaseUrl: string; headers: ReturnType<typeof restHeaders> },
  userId: string
) => {
  const response = await fetch(`${session.supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: session.headers,
    body: JSON.stringify({ shared_list_enabled: true })
  });
  expect(response.ok).toBe(true);
};

const signInOnPage = async (
  page: import('@playwright/test').Page,
  account: { email: string; password: string }
) => {
  await waitForNuxtHydration(page);
  const form = page.locator('form').first();
  await form.getByLabel('Email').fill(account.email);
  await form.locator('input[name="password"]').fill(account.password);
  await form.getByRole('button', { name: 'Sign in' }).click();
};

const anonHeaders = () => {
  const supabaseUrl = (process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || LOCAL_SUPABASE_ANON_KEY;
  return {
    supabaseUrl,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    }
  };
};

const parisToday = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

test('disabled and unknown usernames are the same quiet not-found', async ({ page }, testInfo) => {
  const account = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-${testInfo.retry}`);

  try {
    await page.goto(`/u/${account.username}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: SHARED_LIST_NOT_FOUND })).toBeVisible();
    await expect(page.getByText(SHARED_LIST_EMPTY)).toHaveCount(0);
    await expect(page.getByText(/this user exists/i)).toHaveCount(0);
    await expect(page.getByText(/private/i)).toHaveCount(0);

    const supabaseUrl = (process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/$/, '');
    const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || LOCAL_SUPABASE_ANON_KEY;
    const listed = await fetch(`${supabaseUrl}/rest/v1/shared_list_profiles`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    });
    expect(listed.ok).toBe(false);

    await page.goto('/u/this-username-does-not-exist');
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: SHARED_LIST_NOT_FOUND })).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(account.userId);
  }
});

authTest('enabling sharing makes /u/:username public; disabling matches unknown username', async ({
  authenticatedPage,
  account
}) => {
  await authenticatedPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await authenticatedPage.getByRole('link', { name: 'Profile' }).click();
  await authExpect(authenticatedPage).toHaveURL(/\/profile/);
  await authExpect(authenticatedPage.getByTestId('profile-username')).toHaveText(account.username);
  await authExpect(authenticatedPage.getByText(SHARED_LIST_HELPER)).toBeVisible();
  await authExpect(authenticatedPage.getByRole('button', { name: 'Copy link' })).toHaveCount(0);

  const sharingSwitch = authenticatedPage.getByRole('switch', { name: 'Shared list' });
  await sharingSwitch.click();
  await authExpect(authenticatedPage.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await authExpect(sharingSwitch).toBeEnabled();

  await authenticatedPage.getByRole('button', { name: 'Copy link' }).click();
  const copied = await authenticatedPage.evaluate(async () => navigator.clipboard.readText());
  expect(copied).toContain(`/u/${account.username}`);

  await authenticatedPage.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied');
        }
      }
    });
  });
  await authenticatedPage.getByRole('button', { name: 'Copy link' }).click();
  await authExpect(authenticatedPage.getByLabel('Notifications (F8)')).toContainText(COPY_LINK_FAILED);

  const browser = authenticatedPage.context().browser();
  expect(browser).toBeTruthy();
  const visitorContext = await browser!.newContext();
  const visitorPage = await visitorContext.newPage();

  try {
    await visitorPage.goto(`/u/${account.username}`);
    await waitForNuxtHydration(visitorPage);
    await expect(visitorPage.getByRole('heading', { name: account.username })).toBeVisible();
    await expect(visitorPage.getByTestId('shared-list-empty')).toHaveText(SHARED_LIST_EMPTY);
    await expect(visitorPage.getByRole('button', { name: 'Add concert' })).toHaveCount(0);
    await expect(visitorPage.getByTestId('route-announcer')).toHaveText(`Shared list for ${account.username}`);

    await sharingSwitch.click();
    await authExpect(authenticatedPage.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
    await authExpect(sharingSwitch).toBeEnabled();

    await visitorPage.goto(`/u/${account.username}`);
    await waitForNuxtHydration(visitorPage);
    await expect(visitorPage.getByRole('heading', { name: SHARED_LIST_NOT_FOUND })).toBeVisible();
    await expect(visitorPage.getByText(SHARED_LIST_EMPTY)).toHaveCount(0);
  } finally {
    await visitorPage.close();
    await visitorContext.close();
  }
});

test('Event URLs still work when sharing is off', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-${testInfo.retry}`);

  try {
    const session = await signInRest(owner.email, owner.password);
    const start = parisToday();
    const eventResponse = await fetch(`${session.supabaseUrl}/rest/v1/events?select=id`, {
      method: 'POST',
      headers: session.headers,
      body: JSON.stringify({
        kind: 'single_night',
        name: 'Private Night',
        start_date: start,
        end_date: start,
        place: 'Paris'
      })
    });
    expect(eventResponse.ok).toBe(true);
    const events = await eventResponse.json() as { id: string }[];
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    await page.goto(`/u/${owner.username}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: SHARED_LIST_NOT_FOUND })).toBeVisible();

    await page.goto('/login');
    await waitForNuxtHydration(page);
    const form = page.locator('form').first();
    await form.getByLabel('Email').fill(owner.email);
    await form.locator('input[name="password"]').fill(owner.password);
    await form.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/home/);

    await page.goto(`/e/${eventId}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Private Night' })).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(owner.userId);
  }
});

test('enabled Shared List shows going/attended groups and omits notes, unset, and empty Events', async ({
  page
}, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-own-${testInfo.retry}`);

  try {
    const session = await signInRest(owner.email, owner.password);
    await enableSharing(session, owner.userId);
    const start = addUtcDays(parisToday(), 5);

    const grouped = await postJson<{ id: string }[]>(`${session.supabaseUrl}/rest/v1/events`, session.headers, {
      kind: 'single_night',
      name: 'Two Headliners',
      start_date: start,
      end_date: start,
      place: 'Paris'
    });
    const groupedId = grouped[0]?.id;
    expect(groupedId).toBeTruthy();

    const justice = await postJson<{ id: string }[]>(concertsRest(session.supabaseUrl), session.headers, {
      event_id: groupedId,
      artist: 'Justice',
      date: start,
      place: 'Paris'
    });
    const daft = await postJson<{ id: string }[]>(concertsRest(session.supabaseUrl), session.headers, {
      event_id: groupedId,
      artist: 'Daft Punk',
      date: start,
      place: 'Paris'
    });
    expect(justice[0]?.id).toBeTruthy();
    expect(daft[0]?.id).toBeTruthy();

    await postJson(`${session.supabaseUrl}/rest/v1/attendance`, session.headers, {
      concert_id: justice[0]!.id,
      status: 'going'
    });
    await postJson(`${session.supabaseUrl}/rest/v1/attendance`, session.headers, {
      concert_id: daft[0]!.id,
      status: 'going'
    });
    const notesPatch = await fetch(concertNotesRest(session.supabaseUrl, `concert_id=eq.${justice[0]!.id}`), {
      method: 'PATCH',
      headers: session.headers,
      body: JSON.stringify({ notes: 'Secret pit note.' })
    });
    expect(notesPatch.ok).toBe(true);

    const compact = await postJson<{ id: string }[]>(`${session.supabaseUrl}/rest/v1/events`, session.headers, {
      kind: 'single_night',
      name: 'One Visible',
      start_date: start,
      end_date: start,
      place: 'Lyon'
    });
    const compactId = compact[0]?.id;
    expect(compactId).toBeTruthy();
    const visible = await postJson<{ id: string }[]>(concertsRest(session.supabaseUrl), session.headers, {
      event_id: compactId,
      artist: 'Air',
      date: start,
      place: 'Lyon'
    });
    const hidden = await postJson<{ id: string }[]>(concertsRest(session.supabaseUrl), session.headers, {
      event_id: compactId,
      artist: 'Bill Only',
      date: start,
      place: 'Lyon'
    });
    await postJson(`${session.supabaseUrl}/rest/v1/attendance`, session.headers, {
      concert_id: visible[0]!.id,
      status: 'going'
    });
    expect(hidden[0]?.id).toBeTruthy();

    const emptyBill = await postJson<{ id: string }[]>(`${session.supabaseUrl}/rest/v1/events`, session.headers, {
      kind: 'single_night',
      name: 'Empty Bill Night',
      start_date: start,
      end_date: start,
      place: 'Nice'
    });
    await postJson<{ id: string }[]>(concertsRest(session.supabaseUrl), session.headers, {
      event_id: emptyBill[0]!.id,
      artist: 'Hidden Act',
      date: start,
      place: 'Nice'
    });

    await page.goto(`/u/${owner.username}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: owner.username })).toBeVisible();
    await expect(page.getByTestId('route-announcer')).toHaveText(`Shared list for ${owner.username}`);
    await expect(page.getByText(SHARED_LIST_EMPTY)).toHaveCount(0);
    await expect(page.getByText(SHARED_LIST_NOT_FOUND)).toHaveCount(0);
    await expect(page.getByText('Secret pit note.')).toHaveCount(0);
    await expect(page.getByText('Bill Only')).toHaveCount(0);
    await expect(page.getByText('Empty Bill Night')).toHaveCount(0);
    await expect(page.getByText('Hidden Act')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add concert' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit event' })).toHaveCount(0);

    const groupCard = page.locator('[data-event-card="group"]');
    await expect(groupCard).toHaveCount(1);
    await expect(groupCard.getByText('Two Headliners')).toBeVisible();
    await expect(groupCard.getByText('Justice')).toBeVisible();
    await expect(groupCard.getByText('Daft Punk')).toBeVisible();

    const compactCard = page.locator('[data-event-card="compact"]');
    await expect(compactCard).toHaveCount(1);
    await expect(compactCard.getByText('Air')).toBeVisible();

    const anon = anonHeaders();
    const listedConcerts = await fetch(`${anon.supabaseUrl}/rest/v1/shared_list_concerts`, {
      headers: anon.headers
    });
    expect(listedConcerts.ok).toBe(false);

    const listedNotes = await fetch(concertNotesRest(anon.supabaseUrl, 'select=concert_id,notes'), {
      headers: anon.headers
    });
    expect(listedNotes.ok).toBe(false);

    const listedAttendance = await fetch(`${anon.supabaseUrl}/rest/v1/attendance?select=*`, {
      headers: anon.headers
    });
    expect(listedAttendance.ok).toBe(false);

    const listedEvents = await fetch(`${anon.supabaseUrl}/rest/v1/events?select=id,name`, {
      headers: anon.headers
    });
    expect(listedEvents.ok).toBe(false);

    const rpc = await fetch(`${anon.supabaseUrl}/rest/v1/rpc/get_shared_list_concerts`, {
      method: 'POST',
      headers: {
        ...anon.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requested: owner.username })
    });
    expect(rpc.ok).toBe(true);
    const rpcRows = await rpc.json() as { artist: string; event_name: string }[];
    expect(rpcRows.map(row => row.artist).sort()).toEqual(['Air', 'Daft Punk', 'Justice']);
    expect(rpcRows.some(row => row.event_name === 'Empty Bill Night')).toBe(false);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
  }
});

test('tapping a Shared List Event does not join until the Event URL; joined Events can appear', async ({
  page
}, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-own-${testInfo.retry}`);
  const friend = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-fr-${testInfo.retry}`);
  const visitor = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-vis-${testInfo.retry}`);

  try {
    const ownerSession = await signInRest(owner.email, owner.password);
    const friendSession = await signInRest(friend.email, friend.password);
    await enableSharing(ownerSession, owner.userId);
    const start = addUtcDays(parisToday(), 6);

    const owned = await postJson<{ id: string }[]>(`${ownerSession.supabaseUrl}/rest/v1/events`, ownerSession.headers, {
      kind: 'single_night',
      name: 'Pierre Night',
      start_date: start,
      end_date: start,
      place: 'Paris'
    });
    const ownedId = owned[0]?.id;
    expect(ownedId).toBeTruthy();
    const going = await postJson<{ id: string }[]>(concertsRest(ownerSession.supabaseUrl), ownerSession.headers, {
      event_id: ownedId,
      artist: 'Phoenix',
      date: start,
      place: 'Paris'
    });
    const billOnly = await postJson<{ id: string }[]>(concertsRest(ownerSession.supabaseUrl), ownerSession.headers, {
      event_id: ownedId,
      artist: 'Extra Act',
      date: start,
      place: 'Paris'
    });
    await postJson(`${ownerSession.supabaseUrl}/rest/v1/attendance`, ownerSession.headers, {
      concert_id: going[0]!.id,
      status: 'going'
    });
    expect(billOnly[0]?.id).toBeTruthy();

    const friendsNight = await postJson<{ id: string }[]>(`${friendSession.supabaseUrl}/rest/v1/events`, friendSession.headers, {
      kind: 'single_night',
      name: 'Sam Night',
      start_date: start,
      end_date: start,
      place: 'Lille'
    });
    const friendsId = friendsNight[0]?.id;
    expect(friendsId).toBeTruthy();
    const friendsConcert = await postJson<{ id: string }[]>(concertsRest(friendSession.supabaseUrl), friendSession.headers, {
      event_id: friendsId,
      artist: 'Moodoïd',
      date: start,
      place: 'Lille'
    });
    await postJson(`${ownerSession.supabaseUrl}/rest/v1/event_members`, ownerSession.headers, {
      event_id: friendsId
    });
    await postJson(`${ownerSession.supabaseUrl}/rest/v1/attendance`, ownerSession.headers, {
      concert_id: friendsConcert[0]!.id,
      status: 'going'
    });

    await page.goto('/login');
    await signInOnPage(page, visitor);
    await expect(page).toHaveURL(/\/home/);

    await page.goto(`/u/${owner.username}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: owner.username })).toBeVisible();
    await expect(page.getByText('Phoenix')).toBeVisible();
    await expect(page.getByText('Moodoïd')).toBeVisible();
    await expect(page.getByText('Extra Act')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Mark as (going|attended)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add concert' })).toHaveCount(0);

    const visitorSession = await signInRest(visitor.email, visitor.password);
    const membersBefore = await fetch(
      `${visitorSession.supabaseUrl}/rest/v1/event_members?event_id=eq.${ownedId}&select=user_id`,
      { headers: visitorSession.headers }
    );
    expect(membersBefore.ok).toBe(true);
    expect(await membersBefore.json()).toEqual([]);

    await page.getByRole('link', { name: /Phoenix/ }).click();
    await expect(page).toHaveURL(new RegExp(`/e/${ownedId}`));
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Pierre Night' })).toBeVisible();
    await expect(page.getByText('Phoenix')).toBeVisible();
    await expect(page.getByText('Extra Act')).toBeVisible();
    await expect(page.getByRole('button', { name: /Mark as going/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Attend this night' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit event' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add to this night' })).toHaveCount(0);

    const membersAfter = await fetch(
      `${visitorSession.supabaseUrl}/rest/v1/event_members?event_id=eq.${ownedId}&select=user_id`,
      { headers: visitorSession.headers }
    );
    const memberRows = await membersAfter.json() as { user_id: string }[];
    expect(memberRows).toEqual([{ user_id: visitor.userId }]);

    await page.goto(`/u/${owner.username}`);
    await waitForNuxtHydration(page);
    await page.getByRole('link', { name: /Moodoïd/ }).click();
    await expect(page).toHaveURL(new RegExp(`/e/${friendsId}`));
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Sam Night' })).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(friend.userId);
    await deleteE2EAccountForTest(visitor.userId);
  }
});

test('signed-out tap of a Shared List grouping signs in then joins the Event', async ({ page }, testInfo) => {
  const owner = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-own-${testInfo.retry}`);
  const visitor = await createE2EAccountForTest(`${testInfo.project.name}-${testInfo.title}-vis-${testInfo.retry}`);

  try {
    const session = await signInRest(owner.email, owner.password);
    await enableSharing(session, owner.userId);
    const start = addUtcDays(parisToday(), 7);
    const events = await postJson<{ id: string }[]>(`${session.supabaseUrl}/rest/v1/events`, session.headers, {
      kind: 'single_night',
      name: 'Late Night',
      start_date: start,
      end_date: start,
      place: 'Paris'
    });
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();
    const concerts = await postJson<{ id: string }[]>(concertsRest(session.supabaseUrl), session.headers, {
      event_id: eventId,
      artist: 'Kavinsky',
      date: start,
      place: 'Paris'
    });
    await postJson(`${session.supabaseUrl}/rest/v1/attendance`, session.headers, {
      concert_id: concerts[0]!.id,
      status: 'going'
    });

    await page.goto(`/u/${owner.username}`);
    await waitForNuxtHydration(page);
    await page.getByRole('link', { name: /Kavinsky/ }).click();
    await expect(page).toHaveURL(new RegExp(`/login\\?redirect=/e/${eventId}`));

    await signInOnPage(page, visitor);
    await expect(page).toHaveURL(new RegExp(`/e/${eventId}`));
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'Late Night' })).toBeVisible();
    await expect(page.getByText('Kavinsky')).toBeVisible();
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(visitor.userId);
  }
});
