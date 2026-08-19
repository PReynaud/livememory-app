import {
  createEvent,
  type CreateEventInput,
  type DomainError,
  type DomainResult,
  type EventRecord,
  type EventsClient
} from './events';

export const CONCERT_RULE = {
  requiredArtist: 'required_artist',
  requiredDate: 'required_date',
  requiredEvent: 'required_event',
  dateOutsideEvent: 'date_outside_event'
} as const;

export const CONCERT_RULE_MESSAGE = {
  requiredArtist: 'Artist is required.',
  requiredDate: 'Date is required.',
  requiredEvent: 'Event is required.',
  dateOutsideEvent: 'This date is outside the Event.'
} as const;

export type ConcertRecord = {
  id: string;
  event_id: string;
  artist: string;
  date: string;
  time: string | null;
  place: string;
};

export type CreateConcertInput = {
  artist: string;
  date: string;
  time?: string | null;
  eventId?: string;
  newEvent?: CreateEventInput;
};

type QueryError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
};

type TableApi<T> = {
  insert: (values: Record<string, unknown>) => {
    select: () => {
      single: () => Promise<QueryResult<T>>;
    };
  };
  select: (columns?: string) => {
    order: (
      column: string,
      options?: { ascending?: boolean }
    ) => Promise<QueryResult<T[]>>;
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<QueryResult<T | null>>;
      order: (
        column: string,
        options?: { ascending?: boolean }
      ) => Promise<QueryResult<T[]>>;
    };
  };
  delete: () => {
    eq: (column: string, value: string) => Promise<QueryResult<null>>;
  };
};

export type ConcertsClient = {
  from: {
    (relation: 'events'): TableApi<EventRecord>;
    (relation: 'concerts'): TableApi<ConcertRecord>;
  };
};

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

const trim = (value: string | undefined | null) => (value ?? '').trim();

const fail = <T>(ruleId: string, message: string): DomainResult<T> => ({
  data: null,
  error: { ruleId, message }
});

const ok = <T>(data: T): DomainResult<T> => ({
  data,
  error: null
});

const toDisplayDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) {
    return iso;
  }

  return `${day}/${month}/${year}`;
};

export const formatEventDateRange = (startDate: string, endDate: string): string => {
  if (startDate === endDate) {
    return toDisplayDate(startDate);
  }

  return `${toDisplayDate(startDate)} – ${toDisplayDate(endDate)}`;
};

export const dateOutsideEventMessage = (
  event: Pick<EventRecord, 'start_date' | 'end_date'>
): string => {
  return `${CONCERT_RULE_MESSAGE.dateOutsideEvent} ${formatEventDateRange(event.start_date, event.end_date)}`;
};

const clockTime = (value: string | null | undefined): string | null => {
  const time = trim(value);
  return time || null;
};

const compareConcerts = (left: ConcertRecord, right: ConcertRecord) => {
  const byDate = left.date.localeCompare(right.date);
  if (byDate !== 0) {
    return byDate;
  }

  const byTime = (left.time ?? '99:99').localeCompare(right.time ?? '99:99');
  if (byTime !== 0) {
    return byTime;
  }

  return left.artist.localeCompare(right.artist);
};

const sortConcerts = (concerts: ConcertRecord[]) => {
  return [...concerts].sort(compareConcerts);
};

const persistFailed = (error: QueryError): DomainError => ({
  ruleId: 'persist_failed',
  message: error.message
});

const resolveEvent = async (
  client: ConcertsClient,
  input: CreateConcertInput
): Promise<DomainResult<EventRecord>> => {
  if (input.newEvent) {
    return createEvent(client as unknown as EventsClient, input.newEvent);
  }

  const eventId = trim(input.eventId);
  if (!eventId) {
    return fail(CONCERT_RULE.requiredEvent, CONCERT_RULE_MESSAGE.requiredEvent);
  }

  const { data, error } = await client.from('events').select('*').eq('id', eventId).maybeSingle();

  if (error) {
    return {
      data: null,
      error: persistFailed(error)
    };
  }

  if (!data) {
    return fail(CONCERT_RULE.requiredEvent, CONCERT_RULE_MESSAGE.requiredEvent);
  }

  return ok(data);
};

export const createConcert = async (
  client: ConcertsClient,
  input: CreateConcertInput
): Promise<DomainResult<ConcertRecord>> => {
  const artist = trim(input.artist);
  if (!artist) {
    return fail(CONCERT_RULE.requiredArtist, CONCERT_RULE_MESSAGE.requiredArtist);
  }

  const date = trim(input.date);
  if (!date || !CIVIL_DATE.test(date)) {
    return fail(CONCERT_RULE.requiredDate, CONCERT_RULE_MESSAGE.requiredDate);
  }

  const eventResult = await resolveEvent(client, input);
  if (eventResult.error || !eventResult.data) {
    return {
      data: null,
      error: eventResult.error
    };
  }

  const event = eventResult.data;
  if (date < event.start_date || date > event.end_date) {
    return fail(CONCERT_RULE.dateOutsideEvent, dateOutsideEventMessage(event));
  }

  const payload = {
    event_id: event.id,
    artist,
    date,
    time: clockTime(input.time),
    place: event.place
  };

  const { data, error } = await client.from('concerts').insert(payload).select().single();

  if (error || !data) {
    if (input.newEvent) {
      await client.from('events').delete().eq('id', event.id);
    }

    if (error) {
      return {
        data: null,
        error: persistFailed(error)
      };
    }

    return fail('persist_failed', 'Failed to create concert');
  }

  return ok(data);
};

export const listConcertsForEvent = async (
  client: ConcertsClient,
  eventId: string
): Promise<DomainResult<ConcertRecord[]>> => {
  const id = trim(eventId);
  if (!id) {
    return ok([]);
  }

  const { data, error } = await client.from('concerts').select('*').eq('event_id', id).order('date', { ascending: true });

  if (error) {
    return {
      data: null,
      error: {
        ruleId: 'list_failed',
        message: error.message
      }
    };
  }

  return ok(sortConcerts(data ?? []));
};

export const listOwnedConcerts = async (
  client: ConcertsClient
): Promise<DomainResult<ConcertRecord[]>> => {
  const { data, error } = await client.from('concerts').select('*').order('date', { ascending: true });

  if (error) {
    return {
      data: null,
      error: {
        ruleId: 'list_failed',
        message: error.message
      }
    };
  }

  return ok(sortConcerts(data ?? []));
};
