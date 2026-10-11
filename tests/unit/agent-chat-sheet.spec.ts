import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentChatStore } from '../../app/stores/agent-chat';
import {
  ASSISTANT_ADDING,
  ASSISTANT_ADDED,
  ASSISTANT_NOT_ADDED,
  ASSISTANT_NOTHING_SAVED,
  ASSISTANT_WORKING,
  askDisabled,
  attendanceChipLabel,
  composerBusy,
  proposalCardMeta,
  visibleTranscriptText,
  type AgentProposalCard
} from '../../shared/agent-chat-transcript';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const museCard: AgentProposalCard = {
  artist: 'Muse',
  dateLabel: '17 Jan 2027',
  place: 'Lyon',
  time: '19:30',
  stageName: 'LDLC Arena',
  attendance: 'going',
  note: 'Stage, time, and year were filled in.'
};

const sheet = read('app/components/AppAiChatSheet.vue');
const script = sheet.slice(0, sheet.indexOf('<template>'));

describe('assistant chat sheet', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('$fetch', fetchMock);
    setActivePinia(createPinia());
  });

  it('shows a polite working row and disables Ask assistant while a turn is running', () => {
    expect(ASSISTANT_WORKING).toBe('Working on it — this can take a little while.');
    expect(sheet).toContain('{{ ASSISTANT_WORKING }}');
    expect(sheet).toMatch(/aria-live="polite"/);
    expect(sheet).toMatch(/v-if="turnLoading"/);
    expect(sheet).toMatch(/data-testid="agent-chat-working"/);
    expect(sheet).toMatch(/data-testid="agent-chat-send"/);
    expect(sheet).toMatch(/:disabled="askDisabled\(prompt, turnLoading, confirming, !!pendingProposalId\)"/);
    expect(askDisabled('Add Muse', false, false, true)).toBe(true);
    expect(sheet).toMatch(/:loading="turnLoading"/);
    expect(askDisabled('Add Muse', true, false)).toBe(true);
    expect(askDisabled('', false, false)).toBe(true);
    expect(askDisabled('Add Muse', false, false)).toBe(false);
    expect(composerBusy(true, false)).toBe(true);
    expect(composerBusy(false, false)).toBe(false);
  });

  it('renders the Muse card without JSON, tool names, or ids', () => {
    const poisoned = `{"preview":"secret","operations":[{"name":"create_concert"}]}`;
    const lines = [
      visibleTranscriptText(poisoned),
      visibleTranscriptText(ASSISTANT_NOTHING_SAVED),
      visibleTranscriptText(museCard.artist),
      visibleTranscriptText(proposalCardMeta(museCard)),
      attendanceChipLabel(museCard.attendance),
      visibleTranscriptText(museCard.note)
    ];
    expect(lines[0]).toBe('');
    expect(lines).toContain('Muse');
    expect(lines).toContain('17 Jan 2027 · Lyon · 19:30 · LDLC Arena');
    expect(lines).toContain('Going');
    expect(lines.join('\n')).not.toMatch(/\{|preview|operations|create_concert|set_attendance/);
    expect(sheet).toMatch(/visibleTranscriptText\(message\.text\)/);
    expect(sheet).toMatch(/proposalCardMeta\(message\.card\)/);
    expect(sheet).toMatch(/attendanceChipLabel\(message\.card\.attendance\)/);
    expect(sheet).toMatch(/data-testid="agent-chat-card"/);
    expect(sheet).toMatch(/'Add concert'/);
    expect(sheet).toMatch(/label="Don't add"/);
    expect(sheet).toMatch(/#FF4D8A/);
    expect(sheet).toMatch(/message\.card\.attendance === 'going' \? 'border-\[#FF4D8A\] text-\[#FF4D8A\]'/);
  });

  it('confirms into a receipt and decline writes nothing', async () => {
    expect(ASSISTANT_ADDING).toBe('Adding');
    expect(sheet).toContain('{{ ASSISTANT_ADDING }}');
    expect(sheet).toMatch(/data-testid="agent-chat-adding"/);
    expect(sheet).toMatch(/data-testid="agent-chat-confirm"/);
    expect(sheet).toMatch(/data-testid="agent-chat-cancel"/);
    expect(sheet).toMatch(/chat\.cancelPreview\(\)/);
    expect(sheet).toMatch(/events\.fetchEvents/);
    expect(script).not.toContain('cancelPreview');

    const store = useAgentChatStore();
    store.messages = [
      { role: 'user', text: 'Add Muse' },
      { role: 'assistant', text: ASSISTANT_NOTHING_SAVED, status: 'pending', card: museCard }
    ];
    store.pendingProposalId = 'proposal-1';
    let releaseConfirm: (value: { text: string }) => void = () => undefined;
    const confirmResult = new Promise<{ text: string }>((resolve) => {
      releaseConfirm = resolve;
    });
    fetchMock.mockReturnValue(confirmResult);
    const saving = store.confirm();
    expect(store.confirming).toBe(true);
    expect(store.messages[1]?.status).toBe('pending');
    releaseConfirm({ text: ASSISTANT_ADDED });
    const saved = await saving;
    expect(saved.error).toBeNull();
    expect(store.messages[1]).toMatchObject({ status: 'added', text: ASSISTANT_ADDED });

    store.messages = [
      { role: 'assistant', text: ASSISTANT_NOTHING_SAVED, status: 'pending', card: museCard }
    ];
    store.pendingProposalId = 'proposal-2';
    const calls = fetchMock.mock.calls.length;
    store.cancelPreview();
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(store.messages[0]).toMatchObject({ status: 'skipped', text: ASSISTANT_NOT_ADDED });
  });

  it('keeps the pending card when the sheet closes and reopens', () => {
    expect(sheet).toMatch(/v-model:open="open"/);
    expect(script).not.toMatch(/cancelPreview|if \(!value\)/);

    const store = useAgentChatStore();
    store.open = true;
    store.messages = [
      { role: 'user', text: 'Add Muse' },
      { role: 'assistant', text: ASSISTANT_NOTHING_SAVED, status: 'pending', card: museCard }
    ];
    store.pendingProposalId = 'proposal-1';
    store.open = false;
    expect(store.messages[1]?.status).toBe('pending');
    store.open = true;
    expect(store.open).toBe(true);
    expect(store.messages).toEqual([
      { role: 'user', text: 'Add Muse' },
      { role: 'assistant', text: ASSISTANT_NOTHING_SAVED, status: 'pending', card: museCard }
    ]);
    expect(store.pendingProposalId).toBe('proposal-1');
  });
});
