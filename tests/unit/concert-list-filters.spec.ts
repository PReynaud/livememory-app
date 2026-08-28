import { describe, expect, it } from 'vitest';
import { splitEventsForConcerts, type EventRecord } from '../../shared/domain/events';
import type { ConcertRecord } from '../../shared/domain/concerts';
import {
  buildConcertFilterCatalog,
  concertFilterChips,
  concertListFilterCount,
  emptyConcertListFilters,
  eventMatchesConcertFilters,
  filterEventsByConcertFilters,
  placeFilterId
} from '../../app/utils/concert-list-filters';

const eventAt = (
  id: string,
  name: string,
  start: string,
  extras?: Partial<EventRecord>
): EventRecord => ({
  id,
  owner_id: 'owner-1',
  kind: extras?.kind ?? 'single_night',
  name,
  start_date: start,
  end_date: extras?.end_date ?? start,
  place: extras?.place ?? 'Paris'
});

const concertAt = (
  id: string,
  eventId: string,
  artist: string,
  date: string
): ConcertRecord => ({
  id,
  event_id: eventId,
  owner_id: 'owner-1',
  artist,
  date,
  time: null,
  place: 'Paris'
});

describe('splitEventsForConcerts', () => {
  it('splits on Paris civil date and keeps upcoming ASC then past DESC', () => {
    const now = new Date('2026-08-19T12:00:00Z');
    const upcomingLate = eventAt('b', 'Later', '2026-12-01');
    const upcomingSoon = eventAt('a', 'Soon', '2026-08-19');
    const pastNew = eventAt('c', 'Yesterday', '2026-08-18');
    const pastOld = eventAt('d', 'Last year', '2025-01-01');

    const { upcoming, past } = splitEventsForConcerts(
      [pastOld, upcomingLate, pastNew, upcomingSoon],
      now
    );

    expect(upcoming.map(event => event.name)).toEqual(['Soon', 'Later']);
    expect(past.map(event => event.name)).toEqual(['Yesterday', 'Last year']);
  });
});

describe('concert list filters', () => {
  const night = eventAt('n1', 'Club', '2026-12-01', { place: 'Berlin' });
  const festival = eventAt('f1', 'Rock', '2026-12-02', { kind: 'festival', place: 'Paris', end_date: '2026-12-04' });
  const concerts = {
    n1: [concertAt('c1', 'n1', 'Justice', '2026-12-01')],
    f1: [concertAt('c2', 'f1', 'Air', '2026-12-02')]
  };

  it('ANDs selected criteria and artist query', () => {
    const matched = filterEventsByConcertFilters(
      [night, festival],
      eventId => concerts[eventId as keyof typeof concerts] ?? [],
      { c1: 'going' },
      { ids: ['type:night', 'status:going', placeFilterId('Berlin')], artistQuery: 'just' }
    );

    expect(matched.map(event => event.id)).toEqual(['n1']);
  });

  it('counts ids plus artist query and builds removable chips', () => {
    const filters = {
      ids: ['type:festival', 'year:2025'],
      artistQuery: 'Air'
    };
    expect(concertListFilterCount(filters)).toBe(3);
    expect(concertListFilterCount(emptyConcertListFilters())).toBe(0);

    const catalog = buildConcertFilterCatalog([festival], 'past');
    const chips = concertFilterChips(filters, catalog);
    expect(chips.map(chip => chip.id)).toEqual(['type:festival', 'year:2025', 'artist']);
    expect(chips.at(-1)?.label).toBe('Air');
  });

  it('matches this month in Paris and omits status options when asked', () => {
    const now = new Date('2026-12-10T12:00:00+01:00');
    expect(eventMatchesConcertFilters(night, concerts.n1, {}, {
      ids: ['period:month'],
      artistQuery: ''
    }, now)).toBe(true);

    expect(eventMatchesConcertFilters(eventAt('old', 'Old', '2026-11-30'), [], {}, {
      ids: ['period:month'],
      artistQuery: ''
    }, now)).toBe(false);

    const publicCatalog = buildConcertFilterCatalog([night], 'upcoming', { includeStatus: false });
    expect(publicCatalog.some(section => section.id === 'status')).toBe(false);
    expect(buildConcertFilterCatalog([night], 'upcoming').some(section => section.id === 'status')).toBe(true);
  });
});
