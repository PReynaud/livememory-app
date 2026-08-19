import type { ConcertRecord } from '#shared/domain/concerts';
import type { EventRecord } from '#shared/domain/events';
import { formatCivilDate } from '@/utils/event-dates';

export type ConcertDateGroup = {
  date: string;
  concerts: ConcertRecord[];
};

export const groupConcertsByDate = (concerts: ConcertRecord[]): ConcertDateGroup[] => {
  const groups: ConcertDateGroup[] = [];

  for (const concert of concerts) {
    const last = groups[groups.length - 1];
    if (last && last.date === concert.date) {
      last.concerts.push(concert);
    } else {
      groups.push({ date: concert.date, concerts: [concert] });
    }
  }

  return groups;
};

export const shouldShowDayHeaders = (event: EventRecord, concerts: ConcertRecord[]) => {
  return event.kind === 'festival' || concerts.length >= 2;
};

export const eachCivilDateInclusive = (start: string, end: string): string[] => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    return [];
  }

  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);

  while (current.getTime() <= last.getTime()) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

export const formatConcertDayLabel = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(date);
};

export const formatDayChipParts = (iso: string): { weekday: string; rest: string } => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return { weekday: iso, rest: '' };
  }

  return {
    weekday: new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      timeZone: 'UTC'
    }).format(date),
    rest: new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC'
    }).format(date)
  };
};

export const formatConcertClock = (time: string | null): string => {
  if (!time) {
    return '';
  }

  return time.slice(0, 5);
};

export const isCompactBill = (concerts: ConcertRecord[]) => {
  return concerts.length === 1;
};

export const eventNameDiffersFromArtist = (eventName: string, artist: string) => {
  return eventName.trim().toLowerCase() !== artist.trim().toLowerCase();
};

export const formatConcertMetaLine = (
  concert: Pick<ConcertRecord, 'date' | 'place' | 'time'>,
  stageName?: string | null
) => {
  const parts = [formatCivilDate(concert.date), concert.place];
  const clock = formatConcertClock(concert.time);
  if (clock) {
    parts.push(clock);
  }
  if (stageName) {
    parts.push(stageName);
  }

  return parts.join(' · ');
};
