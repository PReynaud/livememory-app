import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decryptAgentCredential, encryptAgentCredential, resolveAgentEncryptionSecret } from '../../server/utils/agent-crypto';
import { mintAgentCapability, verifyAgentCapability } from '../../server/utils/agent-capability';
import { resolveAgentMcpOrigin, trustedAgentOrigins } from '../../server/utils/agent-origin';
import { cursorAgentUserMessage, isCursorAgentError } from '../../server/utils/agent-errors';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const secret = Buffer.alloc(32, 7).toString('base64');

describe('embedded agent credential security', () => {
  it('encrypts and decrypts a Cursor credential without exposing it in fields', () => {
    const encrypted = encryptAgentCredential('cursor_secret', secret);
    expect(JSON.stringify(encrypted)).not.toContain('cursor_secret');
    expect(decryptAgentCredential(encrypted, secret)).toBe('cursor_secret');
  });

  it('derives a usable key from a non-base64 server secret and rejects placeholders', () => {
    const derived = resolveAgentEncryptionSecret(
      'replace-with-32-byte-base64-key',
      'service-role-fallback-secret'
    );
    expect(derived).toBe('service-role-fallback-secret');
    const encrypted = encryptAgentCredential('cursor_secret', derived);
    expect(decryptAgentCredential(encrypted, derived)).toBe('cursor_secret');
    expect(() => resolveAgentEncryptionSecret(
      'replace-with-32-byte-base64-key',
      'replace-with-local-service-role-key'
    )).toThrow('Agent credential encryption is not configured.');
  });

  it('issues short-lived capabilities with a read or write scope', () => {
    const token = mintAgentCapability({
      userId: 'user-1', scope: 'read', connectionUpdatedAt: '2026-09-10T10:00:00.000Z'
    }, 'capability-secret');
    expect(verifyAgentCapability(token, 'capability-secret')).toMatchObject({
      userId: 'user-1', scope: 'read'
    });
    expect(verifyAgentCapability(token, 'wrong-secret')).toBeNull();
  });
});

describe('embedded agent boundaries', () => {
  it('keeps encrypted provider credentials server-only', () => {
    const migration = read('supabase/migrations/20260910093312_embedded_ai_chat.sql');
    const connections = read('server/utils/agent-connections.ts');
    expect(migration).not.toMatch(/create policy "Authenticated users can select own agent connection"/);
    expect(migration).toMatch(/grant select, insert, update, delete on table public\.agent_connections to service_role/);
    expect(connections).toMatch(/session\.env\.serviceRoleKey/);
    expect(connections).not.toMatch(/session\.accessToken/);
  });

  it('keeps images transient and validates count, type, and size before Cursor', () => {
    const request = read('server/utils/agent-request.ts');
    expect(request).toMatch(/images\.length > 5/);
    expect(request).toMatch(/image\/png/);
    expect(request).toMatch(/15 \* 1024 \* 1024/);
    expect(request).toMatch(/MAX_TOTAL_IMAGE_BYTES/);
    expect(request).toMatch(/Image data is invalid/);
    expect(request).not.toMatch(/storage|from\('/i);
  });

  it('exposes only read tools during preview and does not alter public MCP keys', () => {
    const embedded = read('server/utils/embedded-mcp-server.ts');
    const mcp = read('server/api/mcp/index.ts');
    expect(embedded).toMatch(/if \(scope === 'read'\) return server/);
    expect(embedded).toMatch(/create_concert/);
    expect(embedded).toMatch(/proposal_scope/);
    expect(mcp).toMatch(/readPersonalKeyFromHeaders/);
    expect(mcp).not.toMatch(/agent-capability/);
  });

  it('renders Home only for a healthy connection and refreshes after confirmation', () => {
    const home = read('app/pages/home.vue');
    const sheet = read('app/components/AppAiChatSheet.vue');
    expect(home).toMatch(/v-if="isAssistantReady"/);
    expect(sheet).toMatch(/agent-chat-confirm/);
    expect(sheet).toMatch(/events\.fetchEvents/);
  });

  it('claims a persisted proposal once and binds MCP execution to its exact operations', () => {
    const proposals = read('server/utils/agent-proposals.ts');
    const confirm = read('server/api/agent/confirm.post.ts');
    const mcp = read('server/api/agent/mcp.ts');
    expect(proposals).toMatch(/status=eq\.pending/);
    expect(proposals).toMatch(/status: 'confirmed'/);
    expect(confirm).toMatch(/proposalId/);
    expect(mcp).toMatch(/readConfirmedProposal/);
    expect(mcp).toMatch(/connection\.updated_at !== capability\.connectionUpdatedAt/);
  });

  it('requires configured secrets and a trusted browser origin', () => {
    const request = read('server/utils/agent-request.ts');
    const mcp = read('server/api/agent/mcp.ts');
    const connections = read('server/utils/agent-connections.ts');
    const profile = read('app/pages/profile.vue');
    const runner = read('server/utils/agent-runner.ts');
    expect(request).toMatch(/Agent capability security is not configured/);
    expect(request).toMatch(/Untrusted request origin/);
    expect(request).toMatch(/getRequestURL/);
    expect(request).not.toMatch(/Agent origin is not configured/);
    expect(mcp).toMatch(/Agent capability security is not configured/);
    expect(connections).toMatch(/resolveAgentEncryptionSecret/);
    expect(profile).toMatch(/flex items-center gap-3/);
    expect(runner).toMatch(/id: 'composer-2\.5'/);
    expect(runner).toMatch(/id: 'fast'/);
    expect(runner).toMatch(/value: 'false'/);
    expect(runner).not.toMatch(/id: 'auto'/);
  });

  it('trusts the request origin even when AGENT_ALLOWED_ORIGIN is unset', () => {
    expect(trustedAgentOrigins('https://livememory.pierre-reynaud.fr', '')).toEqual(
      new Set(['https://livememory.pierre-reynaud.fr'])
    );
    expect(trustedAgentOrigins(
      'https://livememory.pierre-reynaud.fr',
      'http://localhost:3000'
    ).has('https://livememory.pierre-reynaud.fr')).toBe(true);
    expect(trustedAgentOrigins(
      'https://livememory.pierre-reynaud.fr',
      'http://localhost:3000'
    ).has('https://evil.example')).toBe(false);
  });

  it('maps cross-realm Cursor AuthenticationError without leaking Authentication is required', () => {
    const cjsLikeAuthError = Object.assign(new Error('Authentication is required.'), {
      name: 'AuthenticationError'
    });
    expect(isCursorAgentError(cjsLikeAuthError)).toBe(true);
    expect(cursorAgentUserMessage(cjsLikeAuthError)).toBe(
      'Your Cursor connection needs to be reconnected.'
    );
    expect(cursorAgentUserMessage(cjsLikeAuthError)).not.toBe('Authentication is required.');

    const runner = read('server/utils/agent-runner.ts');
    const errors = read('server/utils/agent-errors.ts');
    expect(runner).toMatch(/isCursorAgentError/);
    expect(errors).toMatch(/CURSOR_AGENT_ERROR_NAME/);
    expect(runner).not.toMatch(/if \(error instanceof CursorAgentError\)/);
  });

  it('prefers a public AGENT_ALLOWED_ORIGIN for MCP callbacks and skips localhost placeholders', () => {
    expect(resolveAgentMcpOrigin(
      'https://livememory.pierre-reynaud.fr',
      'http://localhost:3000'
    )).toBe('https://livememory.pierre-reynaud.fr');
    expect(resolveAgentMcpOrigin(
      'https://preview.example',
      'https://livememory.pierre-reynaud.fr'
    )).toBe('https://livememory.pierre-reynaud.fr');
    expect(resolveAgentMcpOrigin('https://livememory.pierre-reynaud.fr', '')).toBe(
      'https://livememory.pierre-reynaud.fr'
    );
  });

  it('refreshes the browser session token and accepts cookie auth on agent APIs', () => {
    const store = read('app/stores/agent-chat.ts');
    const session = read('server/utils/agent-session.ts');
    expect(store).toMatch(/useSupabaseSession/);
    expect(store).toMatch(/refreshSession/);
    expect(session).toMatch(/serverSupabaseUser/);
    expect(session).toMatch(/serverSupabaseSession/);
  });
});
