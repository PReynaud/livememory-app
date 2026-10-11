import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { decryptAgentCredential, encryptAgentCredential, resolveAgentEncryptionSecret } from '../../server/utils/agent-crypto';
import { mintAgentCapability, verifyAgentCapability } from '../../server/utils/agent-capability';
import { trustedAgentOrigins } from '../../server/utils/agent-origin';
import { parseProposal } from '../../server/utils/agent-runner';
import { presentProposal } from '../../server/utils/agent-proposal-preview';
import { applyStoredOperations } from '../../server/utils/agent-proposal-apply';
import { useAgentChatStore } from '../../app/stores/agent-chat';
import {
  ASSISTANT_ADDED,
  ASSISTANT_FOLLOW_UP,
  ASSISTANT_LOG_UNCHANGED,
  ASSISTANT_NOT_ADDED,
  ASSISTANT_NOTHING_SAVED,
  ASSISTANT_PLAIN_CHANGE,
  attendanceChipLabel,
  proposalCardMeta
} from '../../shared/agent-chat-transcript';

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

  it('exposes only read tools during preview and keeps public MCP on OAuth', () => {
    const embedded = read('server/utils/embedded-mcp-server.ts');
    const mcp = read('server/api/mcp/index.ts');
    expect(embedded).toMatch(/if \(scope === 'read'\) return server/);
    expect(embedded).toMatch(/create_concert/);
    expect(embedded).toMatch(/proposal_scope/);
    expect(mcp).toMatch(/resolveMcpAccess/);
    expect(mcp).not.toMatch(/readPersonalKeyFromHeaders/);
    expect(mcp).not.toMatch(/agent-capability/);
  });

  it('renders Home only for a healthy connection and refreshes after confirmation', () => {
    const home = read('app/pages/home.vue');
    const sheet = read('app/components/AppAiChatSheet.vue');
    const styles = read('app/assets/css/main.css');
    expect(home).toMatch(/v-if="isAssistantReady"/);
    expect(sheet).toMatch(/agent-chat-confirm/);
    expect(sheet).toMatch(/events\.fetchEvents/);
    expect(sheet).toMatch(/data-testid="agent-chat-images"/);
    expect(sheet).toMatch(/class="sr-only"/);
    expect(sheet).toMatch(/lm-assistant-sheet/);
    expect(sheet).toMatch(/lm-assistant-composer/);
    expect(styles).toMatch(/\.lm-assistant-sheet \{/);
    expect(styles).toMatch(/bottom: 4\.75rem;/);
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
});

const museProposal = {
  preview: 'Stage, time, and year were filled in.',
  operations: [
    {
      name: 'create_concert',
      args: {
        artist: 'Muse',
        date: '2027-01-17',
        time: '19:30',
        place: 'Lyon',
        stageName: 'LDLC Arena'
      }
    },
    {
      name: 'set_attendance',
      args: { concertId: '<created>', status: 'going' }
    },
    { name: 'drop_database', args: { id: 'secret-id' } }
  ]
};

const fencedMuse = (prefix: string) => `${prefix}${JSON.stringify(museProposal)}`;

describe('embedded assistant proposals', () => {
  it('reads a Muse proposal from a json token or a markdown fence and hides the payload', () => {
    for (const text of [
      fencedMuse('json '),
      fencedMuse('json\n'),
      fencedMuse('```json\n') + '\n```',
      fencedMuse('```\n') + '\n```'
    ]) {
      const parsed = parseProposal(text);
      expect(parsed.operations.map(operation => operation.name)).toEqual([
        'create_concert',
        'set_attendance'
      ]);
      const presented = presentProposal(parsed);
      expect(presented.text).toBe(ASSISTANT_NOTHING_SAVED);
      expect(presented.requiresConfirmation).toBe(true);
      expect(presented.card).toMatchObject({
        artist: 'Muse',
        dateLabel: '17 Jan 2027',
        place: 'Lyon',
        time: '19:30',
        stageName: 'LDLC Arena',
        attendance: 'going',
        note: 'Stage, time, and year were filled in.'
      });
      expect(proposalCardMeta(presented.card!)).toBe('17 Jan 2027 · Lyon · 19:30 · LDLC Arena');
      const visible = [
        presented.text,
        presented.card?.artist,
        proposalCardMeta(presented.card!),
        presented.card?.attendance,
        presented.card?.note
      ].join('\n');
      expect(visible).not.toMatch(/\{|preview|operations|create_concert|set_attendance|drop_database|secret-id/);
    }

    const dumped = presentProposal(parseProposal(JSON.stringify({
      preview: 'Aucun Concert Muse en base. Création: Concert (artist=Muse,date=2027-01-17,place=Lyon,stageName=LDLC Arena,time=19:30).',
      operations: museProposal.operations
    })));
    expect(dumped.card?.note).toBe('Stage, time, and year were filled in.');
    expect(dumped.text).not.toMatch(/artist=|Création/);

    const attended = presentProposal({
      preview: 'Stage, time, and year were filled in.',
      operations: [
        museProposal.operations[0]!,
        { name: 'set_attendance', args: { concertId: '<created>', status: 'attended' } }
      ]
    });
    expect(attended.card?.attendance).toBe('attended');
    expect(attendanceChipLabel('attended')).toBe('Attended');
  });

  it('turns unparseable model text into one follow-up question', () => {
    const parsed = parseProposal('```json\n{SECRET_PAYLOAD\n```');
    expect(parsed.operations).toEqual([]);
    expect(parsed.preview).toBe(ASSISTANT_FOLLOW_UP);
    expect(parsed.preview).not.toContain('SECRET_PAYLOAD');
    expect(presentProposal(parsed)).toEqual({
      text: ASSISTANT_FOLLOW_UP,
      card: null,
      requiresConfirmation: false
    });
  });

  it('keeps a plain follow-up when there is nothing to write', () => {
    const parsed = parseProposal('{"preview":"Which city is the show in?","operations":[]}');
    expect(presentProposal(parsed)).toEqual({
      text: 'Which city is the show in?',
      card: null,
      requiresConfirmation: false
    });
  });

  it('summarizes any other write as one plain line', () => {
    const presented = presentProposal({
      preview: '{"delete_concert":true}',
      operations: [{ name: 'delete_concert', args: { concertId: '11111111-1111-4111-8111-111111111111' } }]
    });
    expect(presented).toEqual({
      text: ASSISTANT_PLAIN_CHANGE,
      card: null,
      requiresConfirmation: true
    });
    expect(presented.text).not.toMatch(/delete_concert|\{/);
  });

  it('confirms stored operations in order without a second model turn', async () => {
    const parsed = parseProposal(fencedMuse('```json\n') + '\n```');
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const applied = await applyStoredOperations(parsed.operations, async (name, args) => {
      calls.push({ name, args });
      if (name === 'create_concert') return { ok: true, data: { id: '11111111-1111-4111-8111-111111111111' } };
      return { ok: true, data: null };
    });

    expect(calls.map(call => call.name)).toEqual(['create_concert', 'set_attendance']);
    expect(calls[1]?.args).toMatchObject({
      concertId: '11111111-1111-4111-8111-111111111111',
      status: 'going'
    });
    expect(applied).toEqual({ ok: true, text: ASSISTANT_ADDED });

    const stopped: string[] = [];
    const failed = await applyStoredOperations(parsed.operations, async (name) => {
      stopped.push(name);
      return { ok: false };
    });
    expect(stopped).toEqual(['create_concert']);
    expect(failed).toMatchObject({ ok: false, text: ASSISTANT_LOG_UNCHANGED, wrote: false });

    const partial: string[] = [];
    const rolledBack = await applyStoredOperations(parsed.operations, async (name) => {
      partial.push(name);
      if (name === 'create_concert') return { ok: true, data: { id: '11111111-1111-4111-8111-111111111111' } };
      if (name === 'delete_concert') return { ok: true, data: null };
      return { ok: false };
    });
    expect(partial).toEqual(['create_concert', 'set_attendance', 'delete_concert']);
    expect(rolledBack).toMatchObject({ ok: false, text: ASSISTANT_LOG_UNCHANGED, wrote: false });

    const stuck: string[] = [];
    const undoFailed = await applyStoredOperations(parsed.operations, async (name) => {
      stuck.push(name);
      if (name === 'create_concert') return { ok: true, data: { id: '11111111-1111-4111-8111-111111111111' } };
      return { ok: false };
    });
    expect(stuck).toEqual(['create_concert', 'set_attendance', 'delete_concert']);
    expect(undoFailed).toMatchObject({ ok: false, text: ASSISTANT_LOG_UNCHANGED, wrote: true });

    const request = read('server/utils/agent-request.ts');
    const confirmFn = request.slice(request.indexOf('export const confirmAgentRequest'));
    expect(confirmFn).toMatch(/claimPendingProposal/);
    expect(confirmFn).toMatch(/invokeLogTool/);
    expect(confirmFn).toMatch(/applyStoredOperations/);
    expect(confirmFn).not.toMatch(/runAgentTurn/);
  });

  it('leaves a real concert id untouched and decline writes nothing', async () => {
    const calls: string[] = [];
    await applyStoredOperations([
      { name: 'create_concert', args: { artist: 'Muse', date: '2027-01-17', place: 'Lyon' } },
      { name: 'set_attendance', args: { concertId: '22222222-2222-4222-8222-222222222222', status: 'going' } }
    ], async (name, args) => {
      calls.push(`${name}:${String(args.concertId ?? '')}`);
      return { ok: true, data: { id: '11111111-1111-4111-8111-111111111111' } };
    });
    expect(calls[1]).toBe('set_attendance:22222222-2222-4222-8222-222222222222');

    const fetchMock = vi.fn();
    vi.stubGlobal('$fetch', fetchMock);
    setActivePinia(createPinia());
    const store = useAgentChatStore();
    store.messages.push({
      role: 'assistant',
      text: ASSISTANT_NOTHING_SAVED,
      status: 'pending',
      card: {
        artist: 'Muse',
        dateLabel: '17 Jan 2027',
        place: 'Lyon',
        time: '19:30',
        stageName: 'LDLC Arena',
        attendance: 'going',
        note: 'Stage, time, and year were filled in.'
      }
    });
    store.pendingProposalId = 'proposal-1';
    store.cancelPreview();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.pendingProposalId).toBeNull();
    expect(store.messages[0]).toMatchObject({ status: 'skipped', text: ASSISTANT_NOT_ADDED });
  });
});
