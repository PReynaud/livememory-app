export const EVENT_RULE = {
  requiredName: 'required_name',
  requiredPlace: 'required_place',
  requiredStartDate: 'required_start_date',
  requiredEndDate: 'required_end_date',
  dateOrder: 'date_order',
  invalidKind: 'invalid_kind'
} as const;

export const EVENT_RULE_MESSAGE = {
  requiredName: 'Name is required.',
  requiredPlace: 'Place is required.',
  requiredStartDate: 'Start date is required.',
  requiredDate: 'Date is required.',
  requiredEndDate: 'End date is required.',
  dateOrder: 'End date cannot be before the start date.',
  invalidKind: 'Kind must be single_night or festival.'
} as const;

export const PARIS_TIME_ZONE = 'Europe/Paris';

export type EventKind = 'single_night' | 'festival';

export type EventRecord = {
  id: string;
  owner_id: string;
  kind: EventKind;
  name: string;
  start_date: string;
  end_date: string;
  place: string;
};

export type DomainError = {
  ruleId: string;
  message: string;
};

export type DomainResult<T> = {
  data: T | null;
  error: DomainError | null;
};

export type CreateEventInput = {
  kind: EventKind;
  name: string;
  startDate: string;
  endDate?: string;
  place: string;
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

export type EventsClient = {
  from: (relation: 'events') => {
    insert: (values: Record<string, unknown>) => {
      select: () => {
        single: () => Promise<QueryResult<EventRecord>>;
      };
    };
    select: (columns?: string) => {
      order: (
        column: string,
        options?: { ascending?: boolean }
      ) => Promise<QueryResult<EventRecord[]>>;
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<QueryResult<EventRecord | null>>;
      };
    };
  };
};

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

const trim = (value: string | undefined) => (value ?? '').trim();

const fail = <T>(ruleId: string, message: string): DomainResult<T> => ({
  data: null,
  error: { ruleId, message }
});

const ok = <T>(data: T): DomainResult<T> => ({
  data,
  error: null
});

const isEventKind = (value: string): value is EventKind => {
  return value === 'single_night' || value === 'festival';
};

export const civilDateInTimeZone = (now: Date, timeZone: string): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
};

export const FEATURED_LIMIT = 3;

const compareUpcomingStart = (left: EventRecord, right: EventRecord) => {
  const byDate = left.start_date.localeCompare(right.start_date);
  if (byDate !== 0) {
    return byDate;
  }

  return left.id.localeCompare(right.id);
};

export const sortEventsForConcerts = (events: EventRecord[], now = new Date()): EventRecord[] => {
  const today = civilDateInTimeZone(now, PARIS_TIME_ZONE);
  const upcoming = events
    .filter(event => event.start_date >= today)
    .sort(compareUpcomingStart);
  const past = events
    .filter(event => event.start_date < today)
    .sort((left, right) => right.start_date.localeCompare(left.start_date));

  return [...upcoming, ...past];
};

export const selectFeaturedEvents = (events: EventRecord[], now = new Date()): EventRecord[] => {
  const today = civilDateInTimeZone(now, PARIS_TIME_ZONE);
  return events
    .filter(event => event.start_date >= today)
    .sort(compareUpcomingStart)
    .slice(0, FEATURED_LIMIT);
};

const validateCreateInput = (input: CreateEventInput): DomainResult<{
  kind: EventKind;
  name: string;
  startDate: string;
  endDate: string;
  place: string;
}> => {
  if (!isEventKind(input.kind)) {
    return fail(EVENT_RULE.invalidKind, EVENT_RULE_MESSAGE.invalidKind);
  }

  const name = trim(input.name);
  if (!name) {
    return fail(EVENT_RULE.requiredName, EVENT_RULE_MESSAGE.requiredName);
  }

  const place = trim(input.place);
  if (!place) {
    return fail(EVENT_RULE.requiredPlace, EVENT_RULE_MESSAGE.requiredPlace);
  }

  const startDate = trim(input.startDate);
  if (!startDate || !CIVIL_DATE.test(startDate)) {
    return fail(
      EVENT_RULE.requiredStartDate,
      input.kind === 'single_night'
        ? EVENT_RULE_MESSAGE.requiredDate
        : EVENT_RULE_MESSAGE.requiredStartDate
    );
  }

  if (input.kind === 'single_night') {
    return ok({
      kind: input.kind,
      name,
      startDate,
      endDate: startDate,
      place
    });
  }

  const endDate = trim(input.endDate);
  if (!endDate || !CIVIL_DATE.test(endDate)) {
    return fail(EVENT_RULE.requiredEndDate, EVENT_RULE_MESSAGE.requiredEndDate);
  }

  if (endDate < startDate) {
    return fail(EVENT_RULE.dateOrder, EVENT_RULE_MESSAGE.dateOrder);
  }

  return ok({
    kind: input.kind,
    name,
    startDate,
    endDate,
    place
  });
};

const constraintText = (error: QueryError): string => {
  return [error.message, error.details, error.hint].filter(Boolean).join(' ');
};

const mapInsertError = (error: QueryError): DomainError => {
  if (/events_dates_check/i.test(constraintText(error))) {
    return {
      ruleId: EVENT_RULE.dateOrder,
      message: EVENT_RULE_MESSAGE.dateOrder
    };
  }

  return {
    ruleId: 'persist_failed',
    message: error.message
  };
};

export const createEvent = async (
  client: EventsClient,
  input: CreateEventInput
): Promise<DomainResult<EventRecord>> => {
  const validated = validateCreateInput(input);
  if (validated.error || !validated.data) {
    return {
      data: null,
      error: validated.error
    };
  }

  const payload = {
    kind: validated.data.kind,
    name: validated.data.name,
    start_date: validated.data.startDate,
    end_date: validated.data.endDate,
    place: validated.data.place
  };

  const { data, error } = await client.from('events').insert(payload).select().single();

  if (error) {
    return {
      data: null,
      error: mapInsertError(error)
    };
  }

  if (!data) {
    return fail('persist_failed', 'Failed to create event');
  }

  return ok(data);
};

export const listOwnedEvents = async (
  client: EventsClient,
  options?: { now?: Date }
): Promise<DomainResult<EventRecord[]>> => {
  const { data, error } = await client.from('events').select('*').order('start_date', { ascending: true });

  if (error) {
    return {
      data: null,
      error: {
        ruleId: 'list_failed',
        message: error.message
      }
    };
  }

  return ok(sortEventsForConcerts(data ?? [], options?.now));
};

export const getOwnedEvent = async (
  client: EventsClient,
  id: string
): Promise<DomainResult<EventRecord | null>> => {
  const eventId = trim(id);
  if (!eventId) {
    return ok(null);
  }

  try {
    const { data, error } = await client.from('events').select('*').eq('id', eventId).maybeSingle();

    if (error) {
      if (error.code === '22P02' || /invalid input syntax/i.test(error.message)) {
        return ok(null);
      }

      return {
        data: null,
        error: {
          ruleId: 'get_failed',
          message: error.message
        }
      };
    }

    return ok(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load event';
    if (/invalid input syntax/i.test(message)) {
      return ok(null);
    }

    return {
      data: null,
      error: {
        ruleId: 'get_failed',
        message
      }
    };
  }
};
