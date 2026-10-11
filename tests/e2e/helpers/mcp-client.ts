import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpToolJson } from '../../../server/utils/mcp-log-tools';
import { waitForNuxtHydration } from './wait-for-hydration';

type ToolContent = {
  type?: string;
  text?: string;
};

const REDIRECT_URI = 'http://127.0.0.1/oauth/callback';

const parseToolJson = (result: { content?: unknown }): McpToolJson => {
  const content = Array.isArray(result.content) ? result.content as ToolContent[] : [];
  const text = content.find(entry => entry.type === 'text')?.text;
  if (!text) {
    throw new Error(`MCP tool returned no JSON text: ${JSON.stringify(result)}`);
  }

  return JSON.parse(text) as McpToolJson;
};

export type McpClientSession = {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientName: string;
};

const pkceVerifier = () => randomBytes(32).toString('base64url');

const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

export const registerOauthClient = async (
  baseURL: string,
  clientName: string,
  redirectUri = REDIRECT_URI
) => {
  const response = await fetch(`${baseURL.replace(/\/$/, '')}/api/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'
    })
  });
  const payload = await response.json() as { client_id?: string };
  expect(response.status).toBe(201);
  expect(payload.client_id).toBeTruthy();
  return {
    clientId: payload.client_id as string,
    clientName,
    redirectUri
  };
};

export const connectMcpClient = async (page: Page): Promise<McpClientSession> => {
  const baseURL = new URL(page.url()).origin;
  const clientName = `E2E ${randomUUID()}`;
  const registered = await registerOauthClient(baseURL, clientName);
  const codeVerifier = pkceVerifier();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: registered.clientId,
    redirect_uri: registered.redirectUri,
    code_challenge: s256(codeVerifier),
    code_challenge_method: 'S256',
    state: 'e2e-state'
  });

  await page.route(`${REDIRECT_URI}*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>callback</title>'
    });
  });

  await page.goto(`/oauth/authorize?${params.toString()}`);
  await waitForNuxtHydration(page);
  await expect(page.getByTestId('oauth-client-name')).toHaveText(clientName);
  await page.getByTestId('oauth-allow').click();
  await page.waitForURL(url => url.href.startsWith(REDIRECT_URI));
  const landed = new URL(page.url());
  const code = landed.searchParams.get('code');
  expect(code).toBeTruthy();
  expect(landed.searchParams.get('state')).toBe('e2e-state');

  const tokenResponse = await fetch(`${baseURL}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: registered.redirectUri,
      client_id: registered.clientId,
      code_verifier: codeVerifier
    })
  });
  const tokens = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
  };
  expect(tokenResponse.ok).toBe(true);
  expect(tokens.access_token).toBeTruthy();
  expect(tokens.refresh_token).toBeTruthy();

  await page.goto('/profile');
  await waitForNuxtHydration(page);

  return {
    accessToken: tokens.access_token as string,
    refreshToken: tokens.refresh_token as string,
    clientId: registered.clientId,
    clientName
  };
};

export const revokeMcpGrant = async (page: Page, clientName: string) => {
  await page.goto('/profile');
  await waitForNuxtHydration(page);
  const row = page.getByTestId('oauth-grant').filter({ hasText: clientName });
  await expect(row).toBeVisible();
  await row.getByTestId('oauth-grant-revoke').click();
  await expect(row).toHaveCount(0);
};

export const refreshMcpToken = async (
  baseURL: string,
  clientId: string,
  refreshToken: string
) => {
  return fetch(`${baseURL.replace(/\/$/, '')}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    })
  });
};

export const callMcpTool = async (
  baseURL: string,
  accessToken: string,
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ json: McpToolJson; isError?: boolean }> => {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseURL.replace(/\/$/, '')}/api/mcp`), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json, text/event-stream'
      }
    }
  });
  const client = new Client({ name: 'livememory-e2e', version: '1.0.0' });
  await client.connect(transport);

  try {
    const result = await client.callTool({ name, arguments: args });
    return {
      json: parseToolJson(result),
      isError: result.isError === true
    };
  } finally {
    await client.close().catch(() => undefined);
  }
};

export const postMcpUnauthorized = async (baseURL: string, accessToken?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${baseURL.replace(/\/$/, '')}/api/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'create_concert',
        arguments: {
          artist: 'Should Not Run',
          date: '2026-10-15',
          place: 'Nowhere'
        }
      }
    })
  });
};
