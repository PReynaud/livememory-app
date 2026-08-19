import { describe, expect, it } from 'vitest';
import {
  currentConcertsForEvent,
  omitAttendanceForConcert,
  omitConcert,
  upsertConcert
} from '../../app/utils/concert-mutation-state';
import type { ConcertRecord } from '../../shared/domain/concerts';

const night: ConcertRecord = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  event_id: 'event-1',
  owner_id: 'owner-1',
  artist: 'Justice',
  date: '2026-08-18',
  time: '20:15',
  place: 'Berlin',
  notes: null
};

const other: ConcertRecord = {
  ...night,
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  artist: 'Local Band'
};

describe('concert mutation local state', () => {
  it('keeps a successful edit in lists when a later refresh is unavailable', () => {
    const updated = { ...night, notes: 'Back of the room.' };
    const concerts = upsertConcert([night, other], updated);

    expect(concerts).toEqual([updated, other]);
    expect(currentConcertsForEvent(concerts, 'event-1')).toEqual([updated, other]);
  });

  it('drops a deleted Concert from lists and attendance so a retry does not see it', () => {
    const concerts = omitConcert([night, other], night.id);
    const attendance = omitAttendanceForConcert(
      { [night.id]: 'attended', [other.id]: 'going' },
      night.id
    );

    expect(concerts).toEqual([other]);
    expect(attendance).toEqual({ [other.id]: 'going' });
    expect(currentConcertsForEvent(concerts, 'event-1')).toEqual([other]);
  });
});
