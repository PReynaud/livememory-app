import type { AttendanceStatus } from './attendance';
import { civilDateInTimeZone, PARIS_TIME_ZONE } from './events';

export type SouvenirStats = {
  attended: number;
  events: number;
  going: number;
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
