import { test, expect } from '@playwright/test';
import { createE2EAccountForTest, deleteE2EAccountForTest } from './helpers/e2e-account';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import {
  callMcpTool,
  createPersonalKeyFromProfile,
  postMcpUnauthorized
} from './helpers/mcp-client';
import { EVENT_RULE, EVENT_RULE_MESSAGE } from '../../shared/domain/events';
import { CONCERT_IDENTITY } from '../../shared/domain/concerts';
import type { E2EAccount } from './helpers/e2e-account';

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

const signOutOnPage = async (page: import('@playwright/test').Page) => {
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/profile/);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
};

const appBaseURL = (page: import('@playwright/test').Page) => {
  return new URL(page.url()).origin;
};

const expectOwnershipBlock = (json: { ok?: boolean; ruleId?: string | null; message?: string | null; outcome?: string | null }) => {
  expect(json.ok).toBe(false);
  expect(json.ruleId).toBe(EVENT_RULE.ownership);
  expect(json.message).toBe(EVENT_RULE_MESSAGE.ownership);
  expect(json.outcome).not.toBe('needs_confirm');
};

type ConcertRow = {
  id: string;
  event_id: string;
  artist: string;
  date: string;
  place?: string;
  notes?: string | null;
};

type EventRow = {
  id: string;
  name: string;
};

type AttendanceRow = {
  user_id: string;
  concert_id: string;
  status: string;
};

test('joiner MCP cannot edit the Bill, can join attend and leave, and invalid keys cannot write', async ({
  page
}, testInfo) => {
  test.setTimeout(120_000);

  const owner = await createE2EAccountForTest(`m33-own-${testInfo.workerIndex}-${testInfo.retry}`);
  const joiner = await createE2EAccountForTest(`m33-join-${testInfo.workerIndex}-${testInfo.retry}`);

  try {
    await page.goto('/login');
    await signInOnPage(page, owner);
    await expect(page).toHaveURL(/\/home/);
    const ownerKey = await createPersonalKeyFromProfile(page);
    const baseURL = appBaseURL(page);
    const night = addUtcDays(parisToday(), 10);

    const createdEvent = await callMcpTool(baseURL, ownerKey, 'create_event', {
      kind: 'single_night',
      name: 'MCP Joiner Night',
      startDate: night,
      place: 'Lyon'
    });
    expect(createdEvent.json.ok).toBe(true);
    const event = createdEvent.json.data as EventRow;
    expect(event.id).toBeTruthy();

    const justiceCreated = await callMcpTool(baseURL, ownerKey, 'create_concert', {
      artist: 'MCP Justice',
      date: night,
      eventId: event.id
    });
    expect(justiceCreated.json.ok).toBe(true);
    expect(justiceCreated.json.outcome).toBe(CONCERT_IDENTITY.created);
    const justice = justiceCreated.json.data as ConcertRow;

    const fontainesCreated = await callMcpTool(baseURL, ownerKey, 'create_concert', {
      artist: 'MCP Fontaines',
      date: night,
      eventId: event.id
    });
    expect(fontainesCreated.json.ok).toBe(true);
    const fontaines = fontainesCreated.json.data as ConcertRow;

    const noted = await callMcpTool(baseURL, ownerKey, 'update_concert', {
      concertId: justice.id,
      artist: 'MCP Justice',
      date: night,
      notes: 'Owner only note.'
    });
    expect(noted.json.ok).toBe(true);

    const ownerAttendance = await callMcpTool(baseURL, ownerKey, 'set_attendance', {
      concertId: justice.id,
      status: 'going'
    });
    expect(ownerAttendance.json.ok).toBe(true);

    await signOutOnPage(page);
    await signInOnPage(page, joiner);
    await expect(page).toHaveURL(/\/home/);
    const joinerKey = await createPersonalKeyFromProfile(page);

    const missing = await postMcpUnauthorized(baseURL);
    expect(missing.status).toBe(401);

    const invalid = await postMcpUnauthorized(baseURL, 'lm_not_a_real_key');
    expect(invalid.status).toBe(401);

    const joined = await callMcpTool(baseURL, joinerKey, 'join_event', { eventId: event.id });
    expect(joined.json.ok).toBe(true);

    const seen = await callMcpTool(baseURL, joinerKey, 'get_event', { eventId: event.id });
    expect(seen.json.ok).toBe(true);
    const payload = seen.json.data as { event: EventRow; concerts: ConcertRow[] };
    expect(payload.event.id).toBe(event.id);
    expect(payload.concerts.map(row => row.artist).sort()).toEqual(['MCP Fontaines', 'MCP Justice']);
    expect(payload.concerts.every(row => !row.notes)).toBe(true);

    const listed = await callMcpTool(baseURL, joinerKey, 'list_concerts', { eventId: event.id });
    expect(listed.json.ok).toBe(true);
    const listedConcerts = listed.json.data as ConcertRow[];
    expect(listedConcerts).toHaveLength(2);
    expect(listedConcerts.every(row => !row.notes)).toBe(true);

    expectOwnershipBlock((await callMcpTool(baseURL, joinerKey, 'create_concert', {
      artist: 'MCP Intruder',
      date: night,
      eventId: event.id
    })).json);

    expectOwnershipBlock((await callMcpTool(baseURL, joinerKey, 'update_concert', {
      concertId: justice.id,
      artist: 'MCP Justice Edited',
      date: night
    })).json);

    expectOwnershipBlock((await callMcpTool(baseURL, joinerKey, 'move_concert', {
      concertId: justice.id,
      targetEventId: event.id
    })).json);

    expectOwnershipBlock((await callMcpTool(baseURL, joinerKey, 'delete_concert', {
      concertId: justice.id
    })).json);

    expectOwnershipBlock((await callMcpTool(baseURL, joinerKey, 'update_event', {
      eventId: event.id,
      name: 'Hijacked Night',
      startDate: night,
      place: 'Lyon'
    })).json);

    expectOwnershipBlock((await callMcpTool(baseURL, joinerKey, 'delete_event', {
      eventId: event.id
    })).json);

    const setOwn = await callMcpTool(baseURL, joinerKey, 'set_attendance', {
      concertId: fontaines.id,
      status: 'going'
    });
    expect(setOwn.json.ok).toBe(true);

    const attendAll = await callMcpTool(baseURL, joinerKey, 'attend_this_night', {
      eventId: event.id
    });
    expect(attendAll.json.ok).toBe(true);

    const myAttendance = await callMcpTool(baseURL, joinerKey, 'list_attendance', {});
    expect(myAttendance.json.ok).toBe(true);
    const rows = myAttendance.json.data as AttendanceRow[];
    expect(rows.every(row => row.user_id === joiner.userId)).toBe(true);
    expect(rows.map(row => row.concert_id).sort()).toEqual([fontaines.id, justice.id].sort());
    expect(rows.every(row => row.status === 'going')).toBe(true);

    await page.goto(`/e/${event.id}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'MCP Joiner Night' })).toBeVisible();
    await expect(page.getByText('MCP Justice')).toBeVisible();
    await expect(page.getByText('MCP Fontaines')).toBeVisible();
    await expect(page.getByText('Owner only note.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit event' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Leave Event' })).toBeVisible();

    const left = await callMcpTool(baseURL, joinerKey, 'leave_event', { eventId: event.id });
    expect(left.json.ok).toBe(true);

    await page.getByRole('link', { name: 'Concerts' }).click();
    await waitForNuxtHydration(page);
    await expect(page.getByText('MCP Joiner Night')).toHaveCount(0);

    const afterLeave = await callMcpTool(baseURL, joinerKey, 'list_attendance', {});
    expect(afterLeave.json.ok).toBe(true);
    const leftover = afterLeave.json.data as AttendanceRow[];
    expect(leftover.filter(row => row.concert_id === justice.id || row.concert_id === fontaines.id)).toEqual([]);

    await page.goto(`/e/${event.id}`);
    await waitForNuxtHydration(page);
    await expect(page.getByRole('heading', { name: 'MCP Joiner Night' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave Event' })).toBeVisible();

    const rejoinedEvents = await callMcpTool(baseURL, joinerKey, 'list_events', {});
    expect(rejoinedEvents.json.ok).toBe(true);
    const events = rejoinedEvents.json.data as EventRow[];
    expect(events.some(row => row.id === event.id)).toBe(true);
  } finally {
    await deleteE2EAccountForTest(owner.userId);
    await deleteE2EAccountForTest(joiner.userId);
  }
});
