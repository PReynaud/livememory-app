import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decryptAgentCredential, encryptAgentCredential } from '../../server/utils/agent-crypto';
import { mintAgentCapability, verifyAgentCapability } from '../../server/utils/agent-capability';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const secret = Buffer.alloc(32, 7).toString('base64');

describe('embedded agent credential security', () => {
  it('encrypts and decrypts a Cursor credential without exposing it in fields', () => {
    const encrypted = encryptAgentCredential('cursor_secret', secret);
    expect(JSON.stringify(encrypted)).not.toContain('cursor_secret');
    expect(decryptAgentCredential(encrypted, secret)).toBe('cursor_secret');
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
    expect(request).toMatch(/Agent capability security is not configured/);
    expect(request).toMatch(/Untrusted request origin/);
    expect(mcp).toMatch(/Agent capability security is not configured/);
  });
});
