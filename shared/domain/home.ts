import type { AttendanceStatus } from './attendance';
import { civilDateInTimeZone, PARIS_TIME_ZONE } from './dates';
import type { EventRecord } from './events';

export type SouvenirStats = {
  attended: number;
  events: number;
  going: number;
};

export type ConcertDateTimeRef = {
  id: string;
  event_id: string;
  date: string;
  time: string | null;
};

const UNTIMED_CLOCK = '99:99';

const clockOrNull = (time: string | null | undefined) => {
  const trimmed = (time ?? '').trim();
  return trimmed || null;
};

const toConcertDateTimeRef = (row: {
  id: string;
  event_id: string;
  date: string;
  time?: string | null;
}): ConcertDateTimeRef => ({
  id: row.id,
  event_id: row.event_id,
  date: row.date,
  time: clockOrNull(row.time)
});

const compareLastNightConcerts = (left: ConcertDateTimeRef, right: ConcertDateTimeRef) => {
  const byDate = right.date.localeCompare(left.date);
  if (byDate !== 0) {
    return byDate;
  }

  const byTime = (right.time ?? UNTIMED_CLOCK).localeCompare(left.time ?? UNTIMED_CLOCK);
  if (byTime !== 0) {
    return byTime;
  }

  return right.id.localeCompare(left.id);
};

export const concertRefsForSouvenirs = (
  indexed: Array<{ id: string; event_id: string }>,
  loaded: Array<{ id: string; event_id: string }>
) => {
  const next = new Map<string, string>();
  for (const row of [...indexed, ...loaded]) {
    next.set(row.id, row.event_id);
  }

  return [...next.entries()].map(([id, event_id]) => ({ id, event_id }));
};

export const concertRefsForLastNight = (
  indexed: ConcertDateTimeRef[],
  loaded: Array<{ id: string; event_id: string; date: string; time: string | null }>
): ConcertDateTimeRef[] => {
  const next = new Map<string, ConcertDateTimeRef>();
  for (const row of [...indexed, ...loaded]) {
    next.set(row.id, toConcertDateTimeRef(row));
  }

  return [...next.values()];
};

export const souvenirStats = (input: {
  events: Array<{ id: string; start_date: string }>;
  concerts: Array<{ id: string; event_id: string }>;
  statuses: Record<string, AttendanceStatus | undefined>;
  now?: Date;
}): SouvenirStats => {
  let attended = 0;
  const participated = new Set<string>();

  for (const status of Object.values(input.statuses)) {
    if (status === 'attended') {
      attended += 1;
    }
  }

  for (const concert of input.concerts) {
    if (input.statuses[concert.id] === 'attended') {
      participated.add(concert.event_id);
    }
  }

  const today = civilDateInTimeZone(input.now ?? new Date(), PARIS_TIME_ZONE);
  const going = input.events.filter(event => event.start_date >= today).length;

  return {
    attended,
    events: participated.size,
    going
  };
};

export const selectLastNightEvent = (
  events: EventRecord[],
  concerts: ConcertDateTimeRef[],
  statuses: Record<string, AttendanceStatus | undefined>
): EventRecord | null => {
  const eventsById = new Map(events.map(event => [event.id, event]));
  const ranked = concerts
    .filter(concert => statuses[concert.id] === 'attended')
    .sort(compareLastNightConcerts);

  for (const concert of ranked) {
    const event = eventsById.get(concert.event_id);
    if (event) {
      return event;
    }
  }

  return null;
};
