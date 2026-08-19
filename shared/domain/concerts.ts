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
  dateOutsideEvent: 'date_outside_event',
  impossiblePlace: 'impossible_place',
  needsChoice: 'needs_choice'
} as const;

export const CONCERT_RULE_MESSAGE = {
  requiredArtist: 'Artist is required.',
  requiredDate: 'Date is required.',
  requiredEvent: 'Event is required.',
  dateOutsideEvent: 'This date is outside the Event.',
  impossiblePlace: 'This concert already exists at a different Place.',
  needsChoice: 'This artist and date already exist. Attach to the existing concert or create another.',
  otherEvent: 'This concert already exists on another Event.'
} as const;

export const CONCERT_IDENTITY = {
  created: 'created',
  attached: 'attached',
  needsChoice: 'needs_choice',
  impossiblePlace: 'impossible_place'
} as const;

export type ConcertCreateOutcome = (typeof CONCERT_IDENTITY)[keyof typeof CONCERT_IDENTITY];

export type ConcertIdentityConfirm = 'attach' | 'create';

export type ConcertRecord = {
  id: string;
  event_id: string;
  owner_id: string;
  artist: string;
  date: string;
  time: string | null;
  place: string;
};

export type CreateConcertResult = DomainResult<ConcertRecord> & {
  outcome: ConcertCreateOutcome | null;
};

export type CreateConcertInput = {
  artist: string;
  date: string;
  time?: string | null;
  eventId?: string;
  newEvent?: CreateEventInput;
  confirm?: ConcertIdentityConfirm;
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

type EqFilter<T> = {
  maybeSingle: () => Promise<QueryResult<T | null>>;
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => Promise<QueryResult<T[]>>;
  eq: (column: string, value: string) => EqFilter<T>;
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
    eq: (column: string, value: string) => EqFilter<T>;
  };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      select: () => {
        single: () => Promise<QueryResult<T>>;
      };
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

const eventRangeFromCreateInput = (
  input: CreateEventInput
): Pick<EventRecord, 'start_date' | 'end_date'> | null => {
  const startDate = trim(input.startDate);
  if (!startDate || !CIVIL_DATE.test(startDate)) {
    return null;
  }

  if (input.kind === 'single_night') {
    return { start_date: startDate, end_date: startDate };
  }

  if (input.kind !== 'festival') {
    return null;
  }

  const endDate = trim(input.endDate);
  if (!endDate || !CIVIL_DATE.test(endDate)) {
    return null;
  }

  return { start_date: startDate, end_date: endDate };
};

const isDateInsideEvent = (
  date: string,
  event: Pick<EventRecord, 'start_date' | 'end_date'>
) => {
  return date >= event.start_date && date <= event.end_date;
};

const resolveEvent = async (
  client: ConcertsClient,
  input: CreateConcertInput
): Promise<DomainResult<EventRecord>> => {
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

const failCreate = (
  ruleId: string,
  message: string,
  outcome: ConcertCreateOutcome | null = null
): CreateConcertResult => ({
  data: null,
  error: { ruleId, message },
  outcome
});

const okCreate = (
  data: ConcertRecord,
  outcome: ConcertCreateOutcome
): CreateConcertResult => ({
  data,
  error: null,
  outcome
});

const constraintText = (error: QueryError): string => {
  return [error.code, error.message, error.details, error.hint].filter(Boolean).join(' ');
};

const isUniqueViolation = (error: QueryError): boolean => {
  return error.code === '23505' || /duplicate key|unique constraint/i.test(constraintText(error));
};

const normalizeClock = (value: string | null | undefined): string | null => {
  const time = clockTime(value);
  return time ? time.slice(0, 5) : null;
};

const sameArtist = (left: string, right: string) => {
  return trim(left).toLowerCase() === trim(right).toLowerCase();
};

const samePlace = (left: string, right: string) => {
  return trim(left) === trim(right);
};

const concludeTimedMatch = (
  existing: ConcertRecord,
  targetPlace: string
): CreateConcertResult => {
  if (samePlace(existing.place, targetPlace)) {
    return okCreate(existing, CONCERT_IDENTITY.attached);
  }

  return failCreate(
    CONCERT_RULE.impossiblePlace,
    CONCERT_RULE_MESSAGE.impossiblePlace,
    CONCERT_IDENTITY.impossiblePlace
  );
};

const listIdentityCandidates = async (
  client: ConcertsClient,
  artist: string,
  date: string,
  ownerId?: string | null
): Promise<DomainResult<ConcertRecord[]>> => {
  const byDate = client.from('concerts').select('*').eq('date', date);
  const scoped = ownerId ? byDate.eq('owner_id', ownerId) : byDate;
  const { data, error } = await scoped.order('date', { ascending: true });

  if (error) {
    return {
      data: null,
      error: persistFailed(error)
    };
  }

  return ok((data ?? []).filter(concert => sameArtist(concert.artist, artist)));
};

const timedMatch = (
  candidates: ConcertRecord[],
  draftTime: string | null
): ConcertRecord | null => {
  if (!draftTime) {
    return null;
  }

  return (
    candidates.find((concert) => {
      const existingTime = normalizeClock(concert.time);
      return existingTime !== null && existingTime === draftTime;
    }) ?? null
  );
};

const untimedOverlap = (
  candidates: ConcertRecord[],
  draftTime: string | null
): ConcertRecord[] => {
  return candidates.filter((concert) => {
    const existingTime = normalizeClock(concert.time);
    return draftTime === null || existingTime === null;
  });
};

const pickAttachTarget = (
  overlap: ConcertRecord[],
  draftTime: string | null
): ConcertRecord | null => {
  if (overlap.length === 0) {
    return null;
  }

  if (draftTime) {
    return overlap.find(concert => normalizeClock(concert.time) === null) ?? overlap[0] ?? null;
  }

  return overlap[0] ?? null;
};

const writeAttachTime = async (
  client: ConcertsClient,
  existing: ConcertRecord,
  draftTime: string | null,
  targetPlace: string
): Promise<CreateConcertResult> => {
  if (!draftTime || normalizeClock(existing.time) !== null) {
    return okCreate(existing, CONCERT_IDENTITY.attached);
  }

  const { data, error } = await client
    .from('concerts')
    .update({ time: draftTime })
    .eq('id', existing.id)
    .select()
    .single();

  if (error && isUniqueViolation(error)) {
    const retry = await listIdentityCandidates(
      client,
      existing.artist,
      existing.date,
      existing.owner_id
    );
    if (retry.error) {
      return {
        data: null,
        error: retry.error,
        outcome: null
      };
    }

    const raced = timedMatch(retry.data ?? [], draftTime);
    if (raced) {
      return concludeTimedMatch(raced, targetPlace);
    }

    return failCreate(
      CONCERT_RULE.impossiblePlace,
      CONCERT_RULE_MESSAGE.impossiblePlace,
      CONCERT_IDENTITY.impossiblePlace
    );
  }

  if (error || !data) {
    return failCreate('persist_failed', error?.message ?? 'Failed to update concert time');
  }

  return okCreate(data, CONCERT_IDENTITY.attached);
};

const rollbackNewEvent = async (client: ConcertsClient, eventId: string | null) => {
  if (!eventId) {
    return;
  }

  await client.from('events').delete().eq('id', eventId);
};

const resolveTarget = async (
  client: ConcertsClient,
  input: CreateConcertInput
): Promise<DomainResult<{ event: EventRecord | null; place: string }>> => {
  if (input.newEvent) {
    return ok({
      event: null,
      place: trim(input.newEvent.place)
    });
  }

  const eventResult = await resolveEvent(client, input);
  if (eventResult.error || !eventResult.data) {
    return {
      data: null,
      error: eventResult.error
    };
  }

  return ok({
    event: eventResult.data,
    place: eventResult.data.place
  });
};

export const createConcert = async (
  client: ConcertsClient,
  input: CreateConcertInput
): Promise<CreateConcertResult> => {
  const artist = trim(input.artist);
  if (!artist) {
    return failCreate(CONCERT_RULE.requiredArtist, CONCERT_RULE_MESSAGE.requiredArtist);
  }

  const date = trim(input.date);
  if (!date || !CIVIL_DATE.test(date)) {
    return failCreate(CONCERT_RULE.requiredDate, CONCERT_RULE_MESSAGE.requiredDate);
  }

  if (input.newEvent) {
    const plannedRange = eventRangeFromCreateInput(input.newEvent);
    if (plannedRange && !isDateInsideEvent(date, plannedRange)) {
      return failCreate(
        CONCERT_RULE.dateOutsideEvent,
        dateOutsideEventMessage(plannedRange)
      );
    }
  }

  const draftTime = normalizeClock(input.time);
  const target = await resolveTarget(client, input);
  if (target.error || !target.data) {
    return {
      data: null,
      error: target.error,
      outcome: null
    };
  }

  const candidatesResult = await listIdentityCandidates(
    client,
    artist,
    date,
    target.data.event?.owner_id
  );
  if (candidatesResult.error) {
    return {
      data: null,
      error: candidatesResult.error,
      outcome: null
    };
  }

  const candidates = candidatesResult.data ?? [];
  const exactTimed = timedMatch(candidates, draftTime);
  if (exactTimed) {
    return concludeTimedMatch(exactTimed, target.data.place);
  }

  const overlap = untimedOverlap(candidates, draftTime);
  if (overlap.length > 0 && input.confirm !== 'create') {
    const existing = pickAttachTarget(overlap, draftTime);
    if (existing && input.confirm === 'attach') {
      return writeAttachTime(client, existing, draftTime, target.data.place);
    }

    return {
      data: existing,
      error: null,
      outcome: CONCERT_IDENTITY.needsChoice
    };
  }

  let event = target.data.event;
  let createdEventId: string | null = null;

  if (input.newEvent) {
    const created = await createEvent(client as unknown as EventsClient, input.newEvent);
    if (created.error || !created.data) {
      return {
        data: null,
        error: created.error,
        outcome: null
      };
    }

    event = created.data;
    createdEventId = created.data.id;
  }

  if (!event) {
    return failCreate(CONCERT_RULE.requiredEvent, CONCERT_RULE_MESSAGE.requiredEvent);
  }

  if (!isDateInsideEvent(date, event)) {
    await rollbackNewEvent(client, createdEventId);
    return failCreate(CONCERT_RULE.dateOutsideEvent, dateOutsideEventMessage(event));
  }

  const payload = {
    event_id: event.id,
    artist,
    date,
    time: draftTime,
    place: event.place
  };

  const { data, error } = await client.from('concerts').insert(payload).select().single();

  if (error || !data) {
    await rollbackNewEvent(client, createdEventId);

    if (error && isUniqueViolation(error)) {
      const retry = await listIdentityCandidates(client, artist, date, event.owner_id);
      if (retry.error) {
        return {
          data: null,
          error: retry.error,
          outcome: null
        };
      }

      const raced = timedMatch(retry.data ?? [], draftTime);
      if (raced) {
        return concludeTimedMatch(raced, event.place);
      }

      return failCreate(
        CONCERT_RULE.impossiblePlace,
        CONCERT_RULE_MESSAGE.impossiblePlace,
        CONCERT_IDENTITY.impossiblePlace
      );
    }

    if (error) {
      return {
        data: null,
        error: persistFailed(error),
        outcome: null
      };
    }

    return failCreate('persist_failed', 'Failed to create concert');
  }

  return okCreate(data, CONCERT_IDENTITY.created);
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
