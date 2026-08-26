import { expect, test } from './fixtures/auth.fixture';
import { concertsRest } from './helpers/concert-rest';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from './local-supabase';
import type { E2EAccount } from './helpers/e2e-account';

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

const signIn = async (account: E2EAccount) => {
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

  if (!sessionResponse.ok) {
    throw new Error(`Failed to sign in E2E account: ${await sessionResponse.text()}`);
  }

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

const createEvent = async (
  session: Awaited<ReturnType<typeof signIn>>,
  input: { kind?: 'single_night' | 'festival'; name: string; start: string; end?: string; place: string }
) => {
  const rows = await postJson<{ id: string }[]>(`${session.supabaseUrl}/rest/v1/events`, session.headers, {
    kind: input.kind ?? 'single_night',
    name: input.name,
    start_date: input.start,
    end_date: input.end ?? input.start,
    place: input.place
  });
  const id = rows[0]?.id;
  if (!id) {
    throw new Error('Failed to create event');
  }

  return id;
};

const createConcert = async (
  session: Awaited<ReturnType<typeof signIn>>,
  input: { eventId: string; artist: string; date: string; place: string; time?: string }
) => {
  const payload: Record<string, unknown> = {
    event_id: input.eventId,
    artist: input.artist,
    date: input.date,
    place: input.place
  };
  if (input.time) {
    payload.time = input.time;
  }

  const rows = await postJson<{ id: string }[]>(concertsRest(session.supabaseUrl), session.headers, payload);
  const id = rows[0]?.id;
  if (!id) {
    throw new Error('Failed to create concert');
  }

  return id;
};

const setAttendance = async (
  session: Awaited<ReturnType<typeof signIn>>,
  concertId: string,
  status: 'going' | 'attended'
) => {
  await postJson(`${session.supabaseUrl}/rest/v1/attendance`, session.headers, {
    concert_id: concertId,
    status
  });
};

const reloadHome = async (page: Parameters<typeof waitForNuxtHydration>[0]) => {
  await page.goto('/home');
  await waitForNuxtHydration(page);
};

test('shows empty featured copy and zero souvenir stats that are not tappable', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(authenticatedPage.getByText('Your journal')).toBeVisible();
  await expect(authenticatedPage.getByTestId('home-featured-empty')).toContainText('Nothing upcoming.');
  await expect(authenticatedPage.getByTestId('home-featured-empty')).toContainText('Add a night or a concert.');
  await expect(authenticatedPage.getByTestId('home-featured')).toHaveCount(0);

  const stats = authenticatedPage.getByTestId('home-stats');
  await expect(stats.getByText('Attended')).toBeVisible();
  await expect(stats.getByText('Events')).toBeVisible();
  await expect(stats.getByText('Going')).toBeVisible();
  await expect(stats.locator('[data-stat="attended"]')).toHaveText(/0/);
  await expect(stats.locator('[data-stat="events"]')).toHaveText(/0/);
  await expect(stats.locator('[data-stat="going"]')).toHaveText(/0/);
  await expect(stats.locator('a')).toHaveCount(0);
  await expect(stats.getByRole('link')).toHaveCount(0);

  const before = authenticatedPage.url();
  await stats.click();
  await expect(authenticatedPage).toHaveURL(before);
  await expect(authenticatedPage.getByText('How was it?')).toHaveCount(0);
});

test('features the next 1–3 upcoming Events and keeps the rest of the log on Concerts', async ({
  authenticatedPage,
  account
}) => {
  const session = await signIn(account);
  const today = parisToday();
  const past = addUtcDays(today, -10);
  const first = addUtcDays(today, 2);
  const second = addUtcDays(today, 5);
  const third = addUtcDays(today, 8);
  const fourth = addUtcDays(today, 12);

  await createEvent(session, { name: 'Past Night', start: past, place: 'Berlin' });
  const emptyId = await createEvent(session, { name: 'Empty Soon', start: first, place: 'Paris' });
  await createEvent(session, { name: 'Second Night', start: second, place: 'Lyon' });
  await createEvent(session, { name: 'Third Night', start: third, place: 'Nantes' });
  await createEvent(session, { name: 'Fourth Night', start: fourth, place: 'Lille' });

  await reloadHome(authenticatedPage);

  const featured = authenticatedPage.getByTestId('home-featured');
  await expect(featured).toBeVisible();
  await expect(featured.getByRole('heading', { name: 'Coming up' })).toBeVisible();
  await expect(featured.getByText('3', { exact: true })).toBeVisible();
  await expect(authenticatedPage.getByText('Your journal')).toHaveCount(0);
  await expect(featured.getByText('Empty Soon')).toBeVisible();
  await expect(featured.getByText('Second Night')).toBeVisible();
  await expect(featured.getByText('Third Night')).toBeVisible();
  await expect(featured.getByText('Fourth Night')).toHaveCount(0);
  await expect(featured.getByText('Past Night')).toHaveCount(0);
  await expect(authenticatedPage.getByTestId('home-featured-empty')).toHaveCount(0);
  await expect(authenticatedPage.getByTestId('home-stats').locator('[data-stat="events"]')).toHaveText(/5/);

  await featured.getByRole('link', { name: /Empty Soon/ }).click();
  await expect(authenticatedPage).toHaveURL(new RegExp(`/e/${emptyId}$`));
  await expect(authenticatedPage.getByRole('heading', { name: 'Empty Soon' })).toBeVisible();

  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Concerts', exact: true }).click();
  await expect(authenticatedPage).toHaveURL(/\/concerts/);
  await expect(authenticatedPage.getByText('Empty Soon')).toBeVisible();
  await expect(authenticatedPage.getByText('Second Night')).toBeVisible();
  await expect(authenticatedPage.getByText('Third Night')).toBeVisible();
  await expect(authenticatedPage.getByText('Fourth Night')).toBeVisible();
  await expect(authenticatedPage.getByText('Past Night')).toBeVisible();
});

test('uses compact artist anatomy for one Concert and grouped Event name for two', async ({
  authenticatedPage,
  account
}) => {
  const session = await signIn(account);
  const today = parisToday();
  const nightDate = addUtcDays(today, 3);
  const festStart = addUtcDays(today, 6);
  const festEnd = addUtcDays(today, 8);

  const nightId = await createEvent(session, { name: 'Club Night', start: nightDate, place: 'Berlin' });
  await createConcert(session, {
    eventId: nightId,
    artist: 'Justice',
    date: nightDate,
    place: 'Berlin',
    time: '20:15'
  });

  const festId = await createEvent(session, {
    kind: 'festival',
    name: 'Rock Week',
    start: festStart,
    end: festEnd,
    place: 'Paris'
  });
  await createConcert(session, {
    eventId: festId,
    artist: 'Fontaines D.C.',
    date: festStart,
    place: 'Paris',
    time: '22:00'
  });
  await createConcert(session, {
    eventId: festId,
    artist: 'LCD Soundsystem',
    date: festEnd,
    place: 'Paris',
    time: '21:30'
  });

  await reloadHome(authenticatedPage);

  const featured = authenticatedPage.getByTestId('home-featured');
  const compact = featured.locator('[data-event-card="compact"][data-featured="true"]');
  const group = featured.locator('[data-event-card="group"][data-featured="true"]');

  await expect(compact).toBeVisible();
  await expect(compact.getByRole('link')).toContainText('Justice');
  await expect(compact.getByText('Club Night')).toBeVisible();

  await expect(group).toBeVisible();
  await expect(group.getByRole('link')).toContainText('Rock Week');
  await expect(group.getByText('Fontaines D.C.')).toBeVisible();
  await expect(group.getByText('LCD Soundsystem')).toBeVisible();
  await expect(authenticatedPage.getByText('Justice and Rock Week are waiting.')).toBeVisible();
  await expect(authenticatedPage.getByRole('heading', { name: 'Coming up' })).toBeVisible();
  await expect(authenticatedPage.getByText('Your journal')).toHaveCount(0);

  await compact.getByRole('link').click();
  await expect(authenticatedPage).toHaveURL(new RegExp(`/e/${nightId}$`));
});

test('counts effective attended, owned Events, and going; past nights leave featured', async ({
  authenticatedPage,
  account
}) => {
  const session = await signIn(account);
  const today = parisToday();
  const past = addUtcDays(today, -12);
  const future = addUtcDays(today, 4);

  const pastId = await createEvent(session, { name: 'Past Night', start: past, place: 'Berlin' });
  const pastConcert = await createConcert(session, {
    eventId: pastId,
    artist: 'Fontaines D.C.',
    date: past,
    place: 'Berlin'
  });
  await setAttendance(session, pastConcert, 'attended');

  const futureId = await createEvent(session, { name: 'Future Night', start: future, place: 'Lyon' });
  const futureConcert = await createConcert(session, {
    eventId: futureId,
    artist: 'Justice',
    date: future,
    place: 'Lyon'
  });
  await setAttendance(session, futureConcert, 'going');
  await createEvent(session, { name: 'Empty Future', start: addUtcDays(today, 7), place: 'Nantes' });

  await reloadHome(authenticatedPage);

  const featured = authenticatedPage.getByTestId('home-featured');
  await expect(featured.getByText('Justice')).toBeVisible();
  await expect(featured.getByText('Empty Future')).toBeVisible();
  await expect(featured.getByText('Past Night')).toHaveCount(0);
  await expect(featured.getByText('Fontaines D.C.')).toHaveCount(0);
  await expect(authenticatedPage.getByText('How was it?')).toHaveCount(0);

  const stats = authenticatedPage.getByTestId('home-stats');
  await expect(stats.locator('[data-stat="attended"]')).toHaveText(/1/);
  await expect(stats.locator('[data-stat="events"]')).toHaveText(/3/);
  await expect(stats.locator('[data-stat="going"]')).toHaveText(/1/);

  await authenticatedPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Concerts', exact: true }).click();
  await expect(authenticatedPage.getByText('Past Night')).toBeVisible();
  await expect(authenticatedPage.getByText('Future Night')).toBeVisible();
  await expect(authenticatedPage.getByText('Empty Future')).toBeVisible();
});
