import { test, expect } from './fixtures/auth.fixture';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { callMcpTool, createPersonalKeyFromProfile, postMcpUnauthorized } from './helpers/mcp-client';
import { transparentSingleNightName, CONCERT_IDENTITY, CONCERT_RULE_MESSAGE } from '../../shared/domain/concerts';

const appBaseURL = (page: import('@playwright/test').Page) => {
  return new URL(page.url()).origin;
};

test('MCP create_concert with a personal key appears on Concerts like a form row', async ({
  authenticatedPage
}) => {
  const page = authenticatedPage;
  const key = await createPersonalKeyFromProfile(page);
  const created = await callMcpTool(appBaseURL(page), key, 'create_concert', {
    artist: 'MCP Justice',
    date: '2026-10-15',
    time: '21:00',
    place: 'Nantes'
  });

  expect(created.json.ok).toBe(true);
  expect(created.json.outcome).toBe(CONCERT_IDENTITY.created);
  const concert = created.json.data as { artist?: string; date?: string; place?: string };
  expect(concert.artist).toBe('MCP Justice');
  expect(concert.date).toBe('2026-10-15');
  expect(concert.place).toBe('Nantes');

  await page.getByRole('link', { name: 'Concerts' }).click();
  await waitForNuxtHydration(page);
  const nightName = transparentSingleNightName('2026-10-15', 'Nantes');
  await expect(page.getByRole('link', { name: new RegExp(nightName) })).toBeVisible();
  await expect(page.getByText('MCP Justice')).toBeVisible();
  await expect(page.getByText('21:00').first()).toBeVisible();
  await expect(page.getByText('Nantes').first()).toBeVisible();
});

test('MCP create_concert returns needs_choice and attach keeps a single Concert', async ({
  authenticatedPage
}) => {
  const page = authenticatedPage;
  const key = await createPersonalKeyFromProfile(page);
  const first = await callMcpTool(appBaseURL(page), key, 'create_concert', {
    artist: 'MCP Twin',
    date: '2026-10-16',
    place: 'Bordeaux'
  });
  expect(first.json.ok).toBe(true);
  expect(first.json.outcome).toBe(CONCERT_IDENTITY.created);
  const firstConcert = first.json.data as { id: string };

  const choice = await callMcpTool(appBaseURL(page), key, 'create_concert', {
    artist: 'MCP Twin',
    date: '2026-10-16',
    place: 'Bordeaux'
  });
  expect(choice.json.ok).toBe(false);
  expect(choice.json.outcome).toBe(CONCERT_IDENTITY.needsChoice);
  expect(choice.json.message).toBe(CONCERT_RULE_MESSAGE.needsChoice);
  expect(choice.json.confirm).toEqual(['attach', 'create']);
  expect(choice.isError).toBe(false);

  const attached = await callMcpTool(appBaseURL(page), key, 'create_concert', {
    artist: 'MCP Twin',
    date: '2026-10-16',
    place: 'Bordeaux',
    confirm: 'attach'
  });
  expect(attached.json.ok).toBe(true);
  expect(attached.json.outcome).toBe(CONCERT_IDENTITY.attached);
  const attachedConcert = attached.json.data as { id: string };
  expect(attachedConcert.id).toBe(firstConcert.id);

  await page.getByRole('link', { name: 'Concerts' }).click();
  await waitForNuxtHydration(page);
  await expect(page.getByText('MCP Twin')).toHaveCount(1);
});

test('MCP rejects a missing personal key', async ({ authenticatedPage }) => {
  const response = await postMcpUnauthorized(appBaseURL(authenticatedPage));
  expect(response.status).toBe(401);
});
