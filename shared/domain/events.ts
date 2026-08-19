export const EVENT_RULE = {
  requiredName: 'required_name',
  requiredPlace: 'required_place',
  requiredStartDate: 'required_start_date',
  requiredEndDate: 'required_end_date',
  dateOrder: 'date_order',
  invalidKind: 'invalid_kind',
  ownership: 'ownership',
  concertConflict: 'event_concert_conflict',
  requiredStage: 'required_stage',
  stageNotOnEvent: 'stage_not_on_event',
  placeConflict: 'place_conflict',
  concertIdentity: 'concert_identity'
} as const;

export const EVENT_RULE_MESSAGE = {
  requiredName: 'Name is required.',
  requiredPlace: 'Place is required.',
  requiredStartDate: 'Start date is required.',
  requiredDate: 'Date is required.',
  requiredEndDate: 'End date is required.',
  dateOrder: 'End date cannot be before the start date.',
  invalidKind: 'Kind must be single_night or festival.',
  ownership: 'You do not own this Event.',
  concertConflict: 'These concerts would break the Event rules:',
  requiredStage: 'Stage or Scene is required.',
  stageNotOnEvent: 'Stage or Scene must be on this Event.',
  placeConflict: 'This Place conflicts with the Event Place.',
  concertIdentity: 'Concert identity is invalid.'
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
  allow_place_override?: boolean;
};

export type EventStageRecord = {
  id: string;
  event_id: string;
  name: string;
};

export type EventBillConcert = {
  id: string;
  event_id: string;
  artist: string;
  date: string;
  place: string;
  stage_id: string | null;
};

export type EventMemberRecord = {
  id: string;
  event_id: string;
  user_id: string;
};

export type EventConflict = {
  concertId: string;
  artist: string;
  date: string;
  ruleId: string;
  message: string;
};

export type DomainError = {
  ruleId: string;
  message: string;
  conflicts?: EventConflict[];
};

export type UpdateEventInput = {
  eventId: string;
  name: string;
  startDate: string;
  endDate?: string;
  place: string;
  allowPlaceOverride?: boolean;
  stages?: Array<{ id?: string; name: string }>;
  concertDates?: Array<{ concertId: string; date: string; stageId?: string | null }>;
};

export const eventAllowsPlaceOverride = (
  event: Pick<EventRecord, 'allow_place_override'> | null | undefined
) => {
  return event?.allow_place_override === true;
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

type EqFilter<T> = {
  maybeSingle: () => Promise<QueryResult<T | null>>;
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => Promise<QueryResult<T[]>>;
  eq: (column: string, value: string) => EqFilter<T>;
  in: (column: string, values: string[]) => Promise<QueryResult<T[]>>;
};

type TableApi<T> = {
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => {
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
    in: (column: string, values: string[]) => Promise<QueryResult<null>>;
  };
};

export type EventsClient = {
  from: {
    (relation: 'events'): TableApi<EventRecord>;
    (relation: 'event_stages'): TableApi<EventStageRecord>;
    (relation: 'concerts'): TableApi<EventBillConcert>;
    (relation: 'event_members'): TableApi<EventMemberRecord>;
  };
  rpc: (
    fn: 'save_event_and_concert_dates',
    args: {
      p_event_id: string;
      p_start_date: string;
      p_end_date: string;
      p_concert_dates: Array<{ id: string; date?: string; stage_id?: string | null }> | null;
      p_name?: string;
      p_place?: string;
      p_allow_place_override?: boolean;
      p_stages?: Array<{ id: string; name: string }> | null;
    }
  ) => Promise<QueryResult<EventRecord>>;
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

  return ok({
    ...data,
    allow_place_override: data.allow_place_override === true
  });
};

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
  return `This date is outside the Event. ${formatEventDateRange(event.start_date, event.end_date)}`;
};

export const newStageId = () => crypto.randomUUID();

const persistFailed = (error: QueryError): DomainError => ({
  ruleId: 'persist_failed',
  message: error.message
});

const mapKernelError = (error: QueryError): DomainError => {
  const text = constraintText(error);
  if (/you do not own this event/i.test(text)) {
    return { ruleId: EVENT_RULE.ownership, message: EVENT_RULE_MESSAGE.ownership };
  }
  if (/this date is outside the event/i.test(text)) {
    return { ruleId: EVENT_RULE.concertConflict, message: text };
  }
  if (/this place conflicts with the event place/i.test(text)) {
    return { ruleId: EVENT_RULE.placeConflict, message: EVENT_RULE_MESSAGE.placeConflict };
  }
  if (/stage or scene is required/i.test(text)) {
    return { ruleId: EVENT_RULE.requiredStage, message: EVENT_RULE_MESSAGE.requiredStage };
  }
  if (/stage or scene must be on this event/i.test(text)) {
    return { ruleId: EVENT_RULE.stageNotOnEvent, message: EVENT_RULE_MESSAGE.stageNotOnEvent };
  }
  if (/concert identity is invalid/i.test(text)) {
    return { ruleId: EVENT_RULE.concertIdentity, message: EVENT_RULE_MESSAGE.concertIdentity };
  }
  if (/events_dates_check/i.test(text)) {
    return { ruleId: EVENT_RULE.dateOrder, message: EVENT_RULE_MESSAGE.dateOrder };
  }

  return persistFailed(error);
};

const listBillConcerts = async (
  client: EventsClient,
  eventId: string
): Promise<DomainResult<EventBillConcert[]>> => {
  const { data, error } = await client
    .from('concerts')
    .select('id,event_id,owner_id,artist,date,time,place,stage_id')
    .eq('event_id', eventId)
    .order('date', { ascending: true });

  if (error) {
    return { data: null, error: persistFailed(error) };
  }

  return ok(data ?? []);
};

export const listEventStages = async (
  client: EventsClient,
  eventId: string
): Promise<DomainResult<EventStageRecord[]>> => {
  const id = trim(eventId);
  if (!id) {
    return ok([]);
  }

  const { data, error } = await client
    .from('event_stages')
    .select('*')
    .eq('event_id', id)
    .order('name', { ascending: true });

  if (error) {
    return { data: null, error: persistFailed(error) };
  }

  return ok(data ?? []);
};

export const listOwnedStages = async (
  client: EventsClient
): Promise<DomainResult<EventStageRecord[]>> => {
  const { data, error } = await client
    .from('event_stages')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return { data: null, error: persistFailed(error) };
  }

  return ok(data ?? []);
};

const formatConflictMessage = (conflicts: EventConflict[]): string => {
  const lines = conflicts.map(
    conflict => `${conflict.artist} (${toDisplayDate(conflict.date)}): ${conflict.message}`
  );
  return `${EVENT_RULE_MESSAGE.concertConflict}\n${lines.join('\n')}`;
};

const evaluateConcert = (
  concert: EventBillConcert,
  event: Pick<EventRecord, 'start_date' | 'end_date' | 'place' | 'allow_place_override'>,
  stageIds: Set<string>
): EventConflict | null => {
  if (concert.date < event.start_date || concert.date > event.end_date) {
    return {
      concertId: concert.id,
      artist: concert.artist,
      date: concert.date,
      ruleId: 'date_outside_event',
      message: dateOutsideEventMessage(event)
    };
  }

  if (!eventAllowsPlaceOverride(event) && trim(concert.place) !== trim(event.place)) {
    return {
      concertId: concert.id,
      artist: concert.artist,
      date: concert.date,
      ruleId: EVENT_RULE.placeConflict,
      message: EVENT_RULE_MESSAGE.placeConflict
    };
  }

  if (stageIds.size > 0) {
    if (!concert.stage_id) {
      return {
        concertId: concert.id,
        artist: concert.artist,
        date: concert.date,
        ruleId: EVENT_RULE.requiredStage,
        message: EVENT_RULE_MESSAGE.requiredStage
      };
    }

    if (!stageIds.has(concert.stage_id)) {
      return {
        concertId: concert.id,
        artist: concert.artist,
        date: concert.date,
        ruleId: EVENT_RULE.stageNotOnEvent,
        message: EVENT_RULE_MESSAGE.stageNotOnEvent
      };
    }
  }

  return null;
};

const resolveStageDrafts = (
  stages: Array<{ id?: string; name: string }> | undefined
): Array<{ id: string; name: string }> => {
  if (!stages) {
    return [];
  }

  return stages
    .map(stage => ({
      id: trim(stage.id) || newStageId(),
      name: trim(stage.name)
    }))
    .filter(stage => Boolean(stage.name));
};

const applyEventUpdate = async (
  client: EventsClient,
  eventId: string,
  input: {
    name: string;
    startDate: string;
    endDate: string;
    place: string;
    allowPlaceOverride: boolean;
    previousAllowPlaceOverride: boolean;
    stages?: Array<{ id?: string; name: string }>;
    concertDates?: Array<{ concertId: string; date: string; stageId?: string | null }>;
  }
): Promise<DomainResult<EventRecord>> => {
  const concertsResult = await listBillConcerts(client, eventId);
  if (concertsResult.error || !concertsResult.data) {
    return { data: null, error: concertsResult.error };
  }

  const existingStages = await listEventStages(client, eventId);
  if (existingStages.error) {
    return { data: null, error: existingStages.error };
  }

  const stageDrafts = resolveStageDrafts(input.stages);
  const proposedStages = input.stages ? stageDrafts : (existingStages.data ?? []);
  const stageIds = new Set(proposedStages.map(stage => stage.id));
  const dateByConcert = new Map(
    (input.concertDates ?? []).map(patch => [patch.concertId, patch.date])
  );
  const stageByConcert = new Map(
    (input.concertDates ?? [])
      .filter(patch => patch.stageId !== undefined)
      .map(patch => [patch.concertId, patch.stageId ?? null])
  );

  const proposedEvent: Pick<EventRecord, 'start_date' | 'end_date' | 'place' | 'allow_place_override'> = {
    start_date: input.startDate,
    end_date: input.endDate,
    place: input.place,
    allow_place_override: input.allowPlaceOverride
  };

  const proposedConcerts = concertsResult.data.map((concert) => {
    const nextDate = dateByConcert.get(concert.id) ?? concert.date;
    const nextStage = stageByConcert.has(concert.id)
      ? (stageByConcert.get(concert.id) ?? null)
      : concert.stage_id;
    const inheritPlace = !input.allowPlaceOverride && !input.previousAllowPlaceOverride;
    const nextPlace = inheritPlace ? input.place : concert.place;
    return {
      ...concert,
      date: nextDate,
      stage_id: nextStage,
      place: nextPlace
    };
  });

  if (input.stages && proposedStages.length === 0) {
    for (const concert of proposedConcerts) {
      concert.stage_id = null;
    }
  }

  const conflicts = proposedConcerts
    .map(concert => evaluateConcert(concert, proposedEvent, stageIds))
    .filter((row): row is EventConflict => row !== null);

  if (conflicts.length > 0) {
    return {
      data: null,
      error: {
        ruleId: EVENT_RULE.concertConflict,
        message: formatConflictMessage(conflicts),
        conflicts
      }
    };
  }

  const usedCombinedDates = (input.concertDates ?? []).length > 0;
  const needsRpc = usedCombinedDates || Boolean(input.stages);

  if (needsRpc) {
    const concertPatches = proposedConcerts.map(concert => ({
      id: concert.id,
      date: concert.date,
      stage_id: concert.stage_id
    }));

    const { data, error } = await client.rpc('save_event_and_concert_dates', {
      p_event_id: eventId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_concert_dates: concertPatches.length > 0 ? concertPatches : null,
      p_name: input.name,
      p_place: input.place,
      p_allow_place_override: input.allowPlaceOverride,
      p_stages: input.stages ? proposedStages : null
    });

    if (error) {
      return { data: null, error: mapKernelError(error) };
    }

    if (!data) {
      return fail('persist_failed', 'Failed to update event');
    }

    return ok({
      ...data,
      allow_place_override: data.allow_place_override === true
    });
  }

  const { data, error } = await client
    .from('events')
    .update({
      name: input.name,
      start_date: input.startDate,
      end_date: input.endDate,
      place: input.place,
      allow_place_override: input.allowPlaceOverride
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    return { data: null, error: mapKernelError(error) };
  }

  if (!data) {
    return fail('persist_failed', 'Failed to update event');
  }

  return ok({
    ...data,
    allow_place_override: data.allow_place_override === true
  });
};

export const updateEvent = async (
  client: EventsClient,
  input: UpdateEventInput
): Promise<DomainResult<EventRecord>> => {
  const eventId = trim(input.eventId);
  if (!eventId) {
    return fail(EVENT_RULE.ownership, EVENT_RULE_MESSAGE.ownership);
  }

  const existing = await getOwnedEvent(client, eventId);
  if (existing.error) {
    return { data: null, error: existing.error };
  }
  if (!existing.data) {
    return fail(EVENT_RULE.ownership, EVENT_RULE_MESSAGE.ownership);
  }

  const validated = validateCreateInput({
    kind: existing.data.kind,
    name: input.name,
    startDate: input.startDate,
    endDate: existing.data.kind === 'single_night' ? input.startDate : input.endDate,
    place: input.place
  });
  if (validated.error || !validated.data) {
    return { data: null, error: validated.error };
  }

  return applyEventUpdate(client, eventId, {
    name: validated.data.name,
    startDate: validated.data.startDate,
    endDate: validated.data.endDate,
    place: validated.data.place,
    allowPlaceOverride: input.allowPlaceOverride === undefined
      ? eventAllowsPlaceOverride(existing.data)
      : input.allowPlaceOverride === true,
    previousAllowPlaceOverride: eventAllowsPlaceOverride(existing.data),
    stages: input.stages,
    concertDates: input.concertDates
  });
};

export const deleteEvent = async (
  client: EventsClient,
  eventId: string
): Promise<DomainResult<{ id: string }>> => {
  const id = trim(eventId);
  if (!id) {
    return fail(EVENT_RULE.ownership, EVENT_RULE_MESSAGE.ownership);
  }

  const existing = await getOwnedEvent(client, id);
  if (existing.error) {
    return { data: null, error: existing.error };
  }
  if (!existing.data) {
    return fail(EVENT_RULE.ownership, EVENT_RULE_MESSAGE.ownership);
  }

  const { error } = await client.from('events').delete().eq('id', existing.data.id);
  if (error) {
    return {
      data: null,
      error: persistFailed(error)
    };
  }

  return ok({ id: existing.data.id });
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
