export type AgentProposalCard = {
  artist: string;
  dateLabel: string;
  place: string;
  time: string;
  stageName: string;
  attendance: 'going' | 'attended';
  note: string;
};

export const ASSISTANT_NOTHING_SAVED = 'I couldn\'t find this in your log. Nothing is saved yet.';
export const ASSISTANT_ADDED = 'Added to your log.';
export const ASSISTANT_NOT_ADDED = 'Not added. Your log is unchanged.';
export const ASSISTANT_LOG_UNCHANGED = 'That concert was not added. Your log was not changed.';
export const ASSISTANT_FOLLOW_UP = 'Which night should I add — artist, date, and city?';
export const ASSISTANT_PLAIN_CHANGE = 'A change is ready. Nothing is saved yet.';
export const ASSISTANT_WORKING = 'Working on it — this can take a little while.';
export const ASSISTANT_ADDING = 'Adding';

export const visibleTranscriptText = (text: string) => {
  if (!text || text.includes('{')) return '';
  return text;
};

export const proposalCardMeta = (card: Pick<AgentProposalCard, 'dateLabel' | 'place' | 'time' | 'stageName'>) => {
  return [card.dateLabel, card.place, card.time, card.stageName].filter(Boolean).join(' · ');
};

export const attendanceChipLabel = (attendance: AgentProposalCard['attendance']) => {
  return attendance === 'attended' ? 'Attended' : 'Going';
};

export const composerBusy = (turnLoading: boolean, confirming: boolean, pending = false) => {
  return turnLoading || confirming || pending;
};

export const askDisabled = (prompt: string, turnLoading: boolean, confirming: boolean, pending = false) => {
  return !prompt.trim() || composerBusy(turnLoading, confirming, pending);
};
