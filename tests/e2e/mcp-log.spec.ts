import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test, expect } from './fixtures/auth.fixture';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';
import { OAUTH_GRANTS_EMPTY } from '../../shared/domain/oauth-grants';
import {
  callMcpTool,
  connectMcpClient,
  postMcpUnauthorized,
  refreshMcpToken,
  registerOauthClient,
  revokeMcpGrant
} from './helpers/mcp-client';
import { transparentSingleNightName, CONCERT_IDENTITY, CONCERT_RULE_MESSAGE } from '../../shared/domain/concerts';

const appBaseURL = (page: import('@playwright/test').Page) => {
  return new URL(page.url()).origin;
};

test('MCP create_concert after Allow appears on Concerts, then revoke returns 401', async ({
  authenticatedPage
}) => {
  test.setTimeout(60_000);
  const page = authenticatedPage;
  await page.goto('/profile');
  await waitForNuxtHydration(page);
  await expect(page.getByTestId('oauth-grants-empty')).toHaveText(OAUTH_GRANTS_EMPTY);
  await expect(page.getByTestId('personal-key-create')).toHaveCount(0);
  await expect(page.getByText('Personal key')).toHaveCount(0);

  const session = await connectMcpClient(page);
  const created = await callMcpTool(appBaseURL(page), session.accessToken, 'create_concert', {
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

  const baseURL = appBaseURL(page);
  const refreshed = await refreshMcpToken(baseURL, session.clientId, session.refreshToken);
  expect(refreshed.status).toBe(200);
  const refreshedBody = await refreshed.json() as { access_token?: string };
  expect(refreshedBody.access_token).toBeTruthy();

  await revokeMcpGrant(page, session.clientName);
  await expect(page.getByTestId('oauth-grants-empty')).toHaveText(OAUTH_GRANTS_EMPTY);
  const rejected = await postMcpUnauthorized(baseURL, session.accessToken);
  expect(rejected.status).toBe(401);
  const staleRefresh = await refreshMcpToken(baseURL, session.clientId, session.refreshToken);
  expect(staleRefresh.status).toBe(401);
});

test('MCP create_concert returns needs_choice and attach keeps a single Concert', async ({
  authenticatedPage
}) => {
  test.setTimeout(60_000);
  const page = authenticatedPage;
  const session = await connectMcpClient(page);
  const key = session.accessToken;
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

test('MCP rejects a missing bearer and points at protected-resource metadata', async ({ request, baseURL }) => {
  const origin = baseURL ?? 'http://127.0.0.1:4173';
  const response = await postMcpUnauthorized(origin);
  expect(response.status).toBe(401);
  const challenge = response.headers.get('www-authenticate') ?? '';
  expect(challenge).toContain('resource_metadata=');
  expect(challenge).toContain('/.well-known/oauth-protected-resource');
  const body = await response.json() as { result?: unknown };
  expect(body.result).toBeUndefined();

  const resource = await request.get('/.well-known/oauth-protected-resource', { maxRedirects: 0 });
  const authorizationServer = await request.get('/.well-known/oauth-authorization-server', { maxRedirects: 0 });
  const pathResource = await request.get('/.well-known/oauth-protected-resource/api/mcp', { maxRedirects: 0 });
  expect(resource.status()).toBe(200);
  expect(authorizationServer.status()).toBe(200);
  expect(pathResource.status()).toBe(200);
  expect(resource.headers().location ?? '').not.toContain('/login');
  expect(authorizationServer.headers().location ?? '').not.toContain('/login');
  const resourceBody = await resource.json() as { resource?: string; authorization_servers?: string[] };
  const serverBody = await authorizationServer.json() as {
    response_types_supported?: string[];
    grant_types_supported?: string[];
    code_challenge_methods_supported?: string[];
    registration_endpoint?: string;
  };
  expect(resourceBody.resource).toBe(`${origin}/api/mcp`);
  expect(serverBody.response_types_supported).toContain('code');
  expect(serverBody.grant_types_supported).toContain('refresh_token');
  expect(serverBody.code_challenge_methods_supported).toEqual(['S256']);
  expect(serverBody.registration_endpoint).toContain('/api/oauth/register');
});

test('Deny redirects with access_denied and stores no code', async ({ authenticatedPage, baseURL }) => {
  const page = authenticatedPage;
  const origin = baseURL ?? new URL(page.url()).origin;
  const registered = await registerOauthClient(origin, `Deny ${randomUUID()}`);
  const codeVerifier = randomBytes(32).toString('base64url');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: registered.clientId,
    redirect_uri: registered.redirectUri,
    code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: 'deny-state'
  });

  await page.route('http://127.0.0.1/oauth/callback*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>callback</title>'
    });
  });
  await page.goto(`/oauth/authorize?${params.toString()}`);
  await waitForNuxtHydration(page);
  await page.getByTestId('oauth-deny').click();
  await page.waitForURL(url => url.href.startsWith('http://127.0.0.1/oauth/callback'));
  const landed = new URL(page.url());
  expect(landed.searchParams.get('error')).toBe('access_denied');
  expect(landed.searchParams.get('code')).toBeNull();

  const tokenResponse = await fetch(`${origin}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'not-issued',
      redirect_uri: registered.redirectUri,
      client_id: registered.clientId,
      code_verifier: codeVerifier
    })
  });
  expect(tokenResponse.status).toBe(400);
  const payload = await tokenResponse.json() as { access_token?: string };
  expect(payload.access_token).toBeUndefined();
});

test('signed-out visitor returns to consent after login', async ({ page, account, baseURL }) => {
  const origin = baseURL ?? 'http://127.0.0.1:4173';
  const clientName = `Return ${account.username}`;
  const registered = await registerOauthClient(origin, clientName);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: registered.clientId,
    redirect_uri: registered.redirectUri,
    code_challenge: createHash('sha256').update('a'.repeat(50)).digest('base64url'),
    code_challenge_method: 'S256',
    state: 'back'
  });

  await page.goto(`/oauth/authorize?${params.toString()}`);
  await expect(page).toHaveURL(url => url.pathname === '/login');
  await waitForNuxtHydration(page);
  const form = page.locator('form').first();
  await form.getByLabel('Email').fill(account.email);
  await form.locator('input[name="password"]').fill(account.password);
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(url => url.pathname === '/oauth/authorize');
  await expect(page.getByTestId('oauth-client-name')).toHaveText(clientName);
});
