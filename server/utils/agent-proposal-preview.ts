import type { ProposedOperation } from './agent-proposals';
import {
  ASSISTANT_FOLLOW_UP,
  ASSISTANT_NOTHING_SAVED,
  ASSISTANT_PLAIN_CHANGE,
  type AgentProposalCard
} from '#shared/agent-chat-transcript';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TOOL_NAMES = [
  'create_event', 'update_event', 'delete_event', 'create_concert', 'update_concert',
  'move_concert', 'delete_concert', 'set_attendance', 'clear_attendance',
  'attend_this_night', 'join_event', 'leave_event'
];

export type ProposalPresentation = {
  text: string;
  card: AgentProposalCard | null;
  requiresConfirmation: boolean;
};

const stringArg = (args: Record<string, unknown>, key: string) => {
  return typeof args[key] === 'string' ? args[key].trim() : '';
};

const unsafeCopy = (text: string) => {
  if (!text.trim() || text.includes('{') || text.includes('}')) return true;
  if (/\b(preview|operations)\b/i.test(text)) return true;
  return TOOL_NAMES.some(name => text.includes(name));
};

const FILLED_IN_NOTE = 'Stage, time, and year were filled in.';

const safeNote = (preview: string) => {
  const note = preview.replace(/\s+/g, ' ').trim();
  if (unsafeCopy(note) || note === ASSISTANT_NOTHING_SAVED || note.includes('=') || note.length > 120) return '';
  return note;
};

export const formatConcertDateLabel = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return value.trim();
  return `${Number(match[3])} ${month} ${match[1]}`;
};

const clockLabel = (value: string) => {
  const match = /^(\d{2}:\d{2})/.exec(value.trim());
  return match?.[1] ?? value.trim();
};

const proseOnly = (preview: string) => {
  const text = preview.trim();
  return unsafeCopy(text) ? ASSISTANT_FOLLOW_UP : text;
};

export const presentProposal = (
  proposal: { preview: string; operations: ProposedOperation[] }
): ProposalPresentation => {
  const operations = proposal.operations;
  if (operations.length === 0) {
    return { text: proseOnly(proposal.preview), card: null, requiresConfirmation: false };
  }

  const create = operations.find(operation => operation.name === 'create_concert');
  const attendance = operations.find(operation => operation.name === 'set_attendance');
  const concertWrite = operations.every(operation =>
    operation.name === 'create_concert' || operation.name === 'set_attendance');
  const status = attendance?.args.status;
  if (create && attendance && concertWrite && (status === 'going' || status === 'attended')) {
    return {
      text: ASSISTANT_NOTHING_SAVED,
      requiresConfirmation: true,
      card: {
        artist: stringArg(create.args, 'artist'),
        dateLabel: formatConcertDateLabel(stringArg(create.args, 'date')),
        place: stringArg(create.args, 'place'),
        time: clockLabel(stringArg(create.args, 'time')),
        stageName: stringArg(create.args, 'stageName'),
        attendance: status,
        note: safeNote(proposal.preview) || ((stringArg(create.args, 'time') || stringArg(create.args, 'stageName')) ? FILLED_IN_NOTE : '')
      }
    };
  }

  return { text: ASSISTANT_PLAIN_CHANGE, card: null, requiresConfirmation: true };
};
