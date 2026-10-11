import { civilDateInTimeZone, PARIS_TIME_ZONE, splitEventsForConcerts, type EventRecord } from '#shared/domain/events';
import type { ConcertRecord } from '#shared/domain/concerts';
import { CONCERT_LIST_COPY } from '@/utils/concert-list-copy';

export { EVENTS_LIST_WINDOW } from '#shared/domain/concerts';
export { splitEventsForConcerts };

export type ListTab = 'upcoming' | 'past';
export type AttendanceMap = Record<string, 'going' | 'attended' | null | undefined>;

export type ConcertListFilterState = {
  ids: string[];
  artistQuery: string;
};

export type FilterOption = {
  id: string;
  label: string;
};

export type FilterSection = {
  id: string;
  label: string;
  options: FilterOption[];
};

export type FilterChip = {
  id: string;
  label: string;
};

export const emptyConcertListFilters = (): ConcertListFilterState => ({
  ids: [],
  artistQuery: ''
});

export const cloneConcertListFilters = (
  filters: ConcertListFilterState
): ConcertListFilterState => ({
  ids: [...filters.ids],
  artistQuery: filters.artistQuery
});

export const concertListFilterCount = (filters: ConcertListFilterState) => {
  return filters.ids.length + (filters.artistQuery.trim() ? 1 : 0);
};

export const normalizePlaceKey = (place: string) => place.trim().toLowerCase();

export const placeFilterId = (place: string) => `place:${normalizePlaceKey(place)}`;

export const yearFilterId = (year: string) => `year:${year}`;

const uniqueSorted = (values: string[]) => {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
};

export const buildConcertFilterCatalog = (
  events: EventRecord[],
  tab: ListTab,
  options?: { includeStatus?: boolean }
): FilterSection[] => {
  const sections: FilterSection[] = [];

  if (options?.includeStatus !== false) {
    sections.push({
      id: 'status',
      label: CONCERT_LIST_COPY.status,
      options: [
        { id: 'status:going', label: CONCERT_LIST_COPY.going },
        { id: 'status:attended', label: CONCERT_LIST_COPY.attended }
      ]
    });
  }

  if (tab === 'past') {
    const years = uniqueSorted(events.map(event => event.start_date.slice(0, 4))).reverse();
    if (years.length > 0) {
      sections.push({
        id: 'year',
        label: CONCERT_LIST_COPY.year,
        options: years.map(year => ({ id: yearFilterId(year), label: year }))
      });
    }
  } else {
    sections.push({
      id: 'period',
      label: CONCERT_LIST_COPY.period,
      options: [{ id: 'period:month', label: CONCERT_LIST_COPY.thisMonth }]
    });
  }

  sections.push({
    id: 'type',
    label: CONCERT_LIST_COPY.type,
    options: [
      { id: 'type:festival', label: CONCERT_LIST_COPY.festival },
      { id: 'type:night', label: CONCERT_LIST_COPY.night }
    ]
  });

  const places = uniqueSorted(events.map(event => event.place.trim()).filter(Boolean));
  if (places.length > 0) {
    sections.push({
      id: 'place',
      label: CONCERT_LIST_COPY.place,
      options: places.map(place => ({ id: placeFilterId(place), label: place }))
    });
  }

  return sections;
};

export const concertFilterChips = (
  filters: ConcertListFilterState,
  catalog: FilterSection[]
): FilterChip[] => {
  const labels = new Map<string, string>();
  for (const section of catalog) {
    for (const option of section.options) {
      labels.set(option.id, option.label);
    }
  }

  const chips: FilterChip[] = filters.ids.map(id => ({
    id,
    label: labels.get(id) ?? id
  }));

  const artist = filters.artistQuery.trim();
  if (artist) {
    chips.push({ id: 'artist', label: artist });
  }

  return chips;
};

const matchesStatus = (
  concerts: ConcertRecord[],
  attendance: AttendanceMap,
  filterId: string
) => {
  const wanted = filterId === 'status:going' ? 'going' : 'attended';
  return concerts.some(concert => attendance[concert.id] === wanted);
};

const matchesType = (event: EventRecord, filterId: string) => {
  if (filterId === 'type:festival') {
    return event.kind === 'festival';
  }

  return event.kind === 'single_night';
};

const matchesPlace = (event: EventRecord, filterId: string) => {
  const token = filterId.slice('place:'.length);
  return normalizePlaceKey(event.place) === token
    || normalizePlaceKey(event.place).includes(token);
};

const matchesYear = (event: EventRecord, filterId: string) => {
  return event.start_date.startsWith(filterId.slice('year:'.length));
};

const matchesMonth = (event: EventRecord, now: Date) => {
  const today = civilDateInTimeZone(now, PARIS_TIME_ZONE);
  return event.start_date.slice(0, 7) === today.slice(0, 7);
};

const matchesArtist = (concerts: ConcertRecord[], query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return concerts.some(concert => concert.artist.toLowerCase().includes(needle));
};

export const eventMatchesConcertFilters = (
  event: EventRecord,
  concerts: ConcertRecord[],
  attendance: AttendanceMap,
  filters: ConcertListFilterState,
  now = new Date()
): boolean => {
  if (!matchesArtist(concerts, filters.artistQuery)) {
    return false;
  }

  return filters.ids.every((id) => {
    if (id === 'status:going' || id === 'status:attended') {
      return matchesStatus(concerts, attendance, id);
    }

    if (id === 'type:festival' || id === 'type:night') {
      return matchesType(event, id);
    }

    if (id.startsWith('place:')) {
      return matchesPlace(event, id);
    }

    if (id.startsWith('year:')) {
      return matchesYear(event, id);
    }

    if (id === 'period:month') {
      return matchesMonth(event, now);
    }

    return true;
  });
};

export const filterEventsByConcertFilters = (
  events: EventRecord[],
  concertsForEvent: (eventId: string) => ConcertRecord[],
  attendance: AttendanceMap,
  filters: ConcertListFilterState,
  now = new Date()
) => {
  if (concertListFilterCount(filters) === 0) {
    return events;
  }

  return events.filter(event => eventMatchesConcertFilters(
    event,
    concertsForEvent(event.id),
    attendance,
    filters,
    now
  ));
};

export const paginateConcertEvents = (events: EventRecord[], limit: number) => {
  return events.slice(0, Math.max(0, limit));
};
