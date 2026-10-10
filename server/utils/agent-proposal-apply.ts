import type { ProposedOperation } from './agent-proposals';
import { ASSISTANT_ADDED, ASSISTANT_LOG_UNCHANGED } from '#shared/agent-chat-transcript';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONCERT_ID_TOOLS = new Set([
  'set_attendance', 'clear_attendance', 'update_concert', 'move_concert', 'delete_concert'
]);
const EVENT_ID_TOOLS = new Set([
  'attend_this_night', 'join_event', 'leave_event', 'list_event_stages', 'get_event', 'update_event', 'delete_event'
]);

export type StoredToolResult = { ok: boolean; data?: unknown };

export type AppliedProposal
  = { ok: true; text: string }
    | { ok: false; text: string; wrote: boolean };

export const isPlaceholderId = (value: unknown) => {
  if (typeof value !== 'string') return true;
  return !UUID.test(value.trim());
};

const createdId = (data: unknown) => {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !('id' in data)) return null;
  const id = data.id;
  return typeof id === 'string' && id.trim() ? id : null;
};

const fillCreatedIds = (
  operation: ProposedOperation,
  concertId: string | null,
  eventId: string | null
) => {
  const args = { ...operation.args };
  if (concertId && (CONCERT_ID_TOOLS.has(operation.name) || 'concertId' in args) && isPlaceholderId(args.concertId)) {
    args.concertId = concertId;
  }
  if (eventId && (EVENT_ID_TOOLS.has(operation.name) || 'eventId' in args) && isPlaceholderId(args.eventId)) {
    args.eventId = eventId;
  }
  return args;
};

export const applyStoredOperations = async (
  operations: ProposedOperation[],
  invoke: (name: string, args: Record<string, unknown>) => Promise<StoredToolResult>
): Promise<AppliedProposal> => {
  let concertId: string | null = null;
  let eventId: string | null = null;
  let wrote = false;
  const undo: Array<{ name: string; args: Record<string, unknown> }> = [];

  const fail = async () => {
    if (!wrote || undo.length === 0) {
      return { ok: false as const, text: ASSISTANT_LOG_UNCHANGED, wrote };
    }
    for (const operation of undo.reverse()) {
      try {
        const undone = await invoke(operation.name, operation.args);
        if (!undone.ok) return { ok: false as const, text: ASSISTANT_LOG_UNCHANGED, wrote: true };
      } catch {
        return { ok: false as const, text: ASSISTANT_LOG_UNCHANGED, wrote: true };
      }
    }
    return { ok: false as const, text: ASSISTANT_LOG_UNCHANGED, wrote: false };
  };

  for (const operation of operations) {
    const args = fillCreatedIds(operation, concertId, eventId);
    let result: StoredToolResult;
    try {
      result = await invoke(operation.name, args);
    } catch {
      return await fail();
    }
    if (!result.ok) return await fail();
    wrote = true;
    const id = createdId(result.data);
    if (id && operation.name === 'create_concert') {
      concertId = id;
      undo.push({ name: 'delete_concert', args: { concertId: id, confirm: true } });
    }
    if (id && operation.name === 'create_event') {
      eventId = id;
      undo.push({ name: 'delete_event', args: { eventId: id, confirm: true } });
    }
    if (operation.name === 'set_attendance' && concertId && args.concertId === concertId) {
      undo.push({ name: 'clear_attendance', args: { concertId } });
    }
  }

  return { ok: true, text: ASSISTANT_ADDED };
};
