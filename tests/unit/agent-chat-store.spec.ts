import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentChatStore } from '../../app/stores/agent-chat';
import {
  ASSISTANT_ADDED,
  ASSISTANT_LOG_UNCHANGED,
  ASSISTANT_NOT_ADDED,
  ASSISTANT_NOTHING_SAVED,
  type AgentProposalCard
} from '../../shared/agent-chat-transcript';

const museCard: AgentProposalCard = {
  artist: 'Muse',
  dateLabel: '17 Jan 2027',
  place: 'Lyon',
  time: '19:30',
  stageName: 'LDLC Arena',
  attendance: 'going',
  note: 'Stage, time, and year were filled in.'
};

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('agent chat store', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('$fetch', fetchMock);
    setActivePinia(createPinia());
  });

  it('shows the user line and turn loading before the request resolves', async () => {
    const pending = deferred<{ text: string; proposalId: string; requiresConfirmation: boolean; card: null }>();
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/agent/connection') return pending.promise;
      return pending.promise;
    });
    const store = useAgentChatStore();
    const status = store.fetchStatus();
    expect(store.loading).toBe(true);
    expect(store.turnLoading).toBe(false);
    pending.resolve({ connected: true, healthy: true } as never);
    await status;
    expect(store.turnLoading).toBe(false);

    const turn = deferred<{ text: string; proposalId: string; requiresConfirmation: boolean; card: AgentProposalCard }>();
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/agent/turn') return turn.promise;
      return Promise.resolve({ connected: true, healthy: true });
    });
    const sending = store.send('Add Muse in Lyon', []);
    expect(store.turnLoading).toBe(true);
    expect(store.loading).toBe(false);
    expect(store.messages).toEqual([{ role: 'user', text: 'Add Muse in Lyon' }]);
    turn.resolve({
      text: ASSISTANT_NOTHING_SAVED,
      proposalId: 'proposal-1',
      requiresConfirmation: true,
      card: museCard
    });
    await sending;
    expect(store.turnLoading).toBe(false);
    expect(store.messages[1]).toMatchObject({
      role: 'assistant',
      text: ASSISTANT_NOTHING_SAVED,
      status: 'pending',
      card: museCard
    });
    expect(store.pendingProposalId).toBe('proposal-1');
  });

  it('does not add a success line when the turn fails', async () => {
    fetchMock.mockRejectedValue(new Error('Cursor could not complete this turn.'));
    const store = useAgentChatStore();
    const result = await store.send('Add Muse', []);
    expect(result.error).toBe('Cursor could not complete this turn.');
    expect(store.error).toBe('Cursor could not complete this turn.');
    expect(store.messages).toEqual([{ role: 'user', text: 'Add Muse' }]);
    expect(store.turnLoading).toBe(false);
  });

  it('keeps connection actions off the turn-loading flag', async () => {
    const pending = deferred<{ connected: boolean; healthy: boolean }>();
    fetchMock.mockReturnValue(pending.promise);
    const store = useAgentChatStore();
    const connecting = store.connect('cursor_key');
    expect(store.loading).toBe(true);
    expect(store.turnLoading).toBe(false);
    pending.resolve({ connected: true, healthy: true });
    await connecting;
    expect(store.turnLoading).toBe(false);

    const disconnecting = store.disconnect();
    expect(store.turnLoading).toBe(false);
    expect(store.loading).toBe(true);
    await disconnecting;
  });

  it('confirms the pending card into a receipt and leaves it pending when the write fails', async () => {
    const store = useAgentChatStore();
    store.messages = [
      { role: 'user', text: 'Add Muse' },
      { role: 'assistant', text: ASSISTANT_NOTHING_SAVED, status: 'pending', card: museCard }
    ];
    store.pendingProposalId = 'proposal-1';
    const confirm = deferred<{ text: string }>();
    fetchMock.mockReturnValue(confirm.promise);
    const saving = store.confirm();
    expect(store.confirming).toBe(true);
    expect(store.turnLoading).toBe(false);
    expect(store.messages[1]?.status).toBe('pending');
    confirm.resolve({ text: ASSISTANT_ADDED });
    await saving;
    expect(store.confirming).toBe(false);
    expect(store.messages[1]).toMatchObject({ status: 'added', text: ASSISTANT_ADDED, card: museCard });
    expect(store.pendingProposalId).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/agent/confirm', expect.objectContaining({
      method: 'POST',
      body: { proposalId: 'proposal-1' }
    }));

    store.messages = [
      { role: 'assistant', text: ASSISTANT_NOTHING_SAVED, status: 'pending', card: museCard }
    ];
    store.pendingProposalId = 'proposal-2';
    fetchMock.mockRejectedValue(new Error('database down'));
    const failed = await store.confirm();
    expect(failed.error).toBe(ASSISTANT_LOG_UNCHANGED);
    expect(store.error).toBe(ASSISTANT_LOG_UNCHANGED);
    expect(store.messages[0]?.status).toBe('pending');
    expect(store.pendingProposalId).toBe('proposal-2');
  });

  it('skips the card without posting and keeps it when the sheet closes', () => {
    const store = useAgentChatStore();
    store.open = true;
    store.messages = [
      { role: 'user', text: 'Add Muse' },
      { role: 'assistant', text: ASSISTANT_NOTHING_SAVED, status: 'pending', card: museCard }
    ];
    store.pendingProposalId = 'proposal-1';
    store.open = false;
    store.open = true;
    expect(store.messages).toHaveLength(2);
    expect(store.messages[1]).toMatchObject({ status: 'pending', card: museCard });
    expect(store.pendingProposalId).toBe('proposal-1');

    store.cancelPreview();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.messages[1]).toMatchObject({ status: 'skipped', text: ASSISTANT_NOT_ADDED });
    expect(store.pendingProposalId).toBeNull();
    expect(store.open).toBe(true);
  });
});
