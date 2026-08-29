import {
  isConcertPast,
  listMyAttendance,
  setAttendance,
  type AttendanceClient
} from './attendance';
import {
  createEvent,
  eventAllowsPlaceOverride,
  EVENT_RULE,
  EVENT_RULE_MESSAGE,
  type CreateEventInput,
  type DomainError,
  type DomainResult,
  type EventMemberRecord,
  type EventRecord,
  type EventStageRecord,
  type EventsClient
} from './events';

export const CONCERT_RULE = {
  requiredArtist: 'required_artist',
  requiredDate: 'required_date',
  requiredEvent: 'required_event',
  requiredPlace: 'required_place',
  requiredStage: 'required_stage',
  stageNotOnEvent: 'stage_not_on_event',
  dateOutsideEvent: 'date_outside_event',
  placeConflict: 'place_conflict',
  impossiblePlace: 'impossible_place',
  needsChoice: 'needs_choice',
  ownership: 'ownership'
} as const;

export const CONCERT_RULE_MESSAGE = {
  requiredArtist: 'Artist is required.',
  requiredDate: 'Date is required.',
  requiredEvent: 'Event is required.',
  requiredPlace: 'Place is required.',
  requiredStage: 'Stage or Scene is required.',
  stageNotOnEvent: 'Stage or Scene must be on this Event.',
  dateOutsideEvent: 'This date is outside the Event.',
  placeConflict: 'This Place conflicts with the Event Place.',
  impossiblePlace: 'This concert already exists at a different Place.',
  needsChoice: 'This artist and date already exist. Attach to the existing concert or create another.',
  otherEvent: 'This concert already exists on another Event.',
  ownership: 'You do not own this concert.'
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
  notes?: string | null;
  stage_id?: string | null;
  stage_name?: string | null;
};

/** Columns `authenticated` may SELECT on `concerts` after notes moved to `concert_notes`. */
export const CONCERT_VISIBLE_COLUMNS
  = 'id,event_id,owner_id,artist,date,time,place,stage_id,stage_name' as const;

export type CreateConcertResult = DomainResult<ConcertRecord> & {
  outcome: ConcertCreateOutcome | null;
};

export type CreateConcertInput = {
  artist: string;
  date: string;
  time?: string | null;
  place?: string;
  stageId?: string | null;
  stageName?: string | null;
  eventId?: string;
  newEvent?: CreateEventInput;
  confirm?: ConcertIdentityConfirm;
};

export type UpdateConcertInput = {
  concertId: string;
  artist: string;
  date: string;
  time?: string | null;
  notes?: string | null;
  confirm?: ConcertIdentityConfirm;
  place?: string;
  stageId?: string | null;
  stageName?: string | null;
  eventId?: string;
};

export type MoveConcertInput = {
  concertId: string;
  targetEventId: string;
  place?: string;
  stageId?: string | null;
  stageName?: string | null;
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
    select: (columns?: string) => {
      single: () => Promise<QueryResult<T>>;
    };
  };
  select: (columns?: string) => {
    order: (
      column: string,
      options?: { ascending?: boolean }
    ) => Promise<QueryResult<T[]>>;
    eq: (column: string, value: string) => EqFilter<T>;
    in: (
      column: string,
      values: readonly string[]
    ) => {
      order: (
        orderColumn: string,
        options?: { ascending?: boolean }
      ) => Promise<QueryResult<T[]>>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      select: (columns?: string) => {
        single: () => Promise<QueryResult<T>>;
      };
    };
  };
  delete: () => {
    eq: (column: string, value: string) => Promise<QueryResult<null>>;
  };
};

export type ConcertNoteRecord = {
  concert_id: string;
  notes: string | null;
};

export type ConcertsClient = {
  from: {
    (relation: 'events'): TableApi<EventRecord>;
    (relation: 'concerts'): TableApi<ConcertRecord>;
    (relation: 'event_stages'): TableApi<EventStageRecord>;
    (relation: 'concert_notes'): TableApi<ConcertNoteRecord>;
    (relation: 'event_members'): TableApi<EventMemberRecord>;
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

export const transparentSingleNightName = (
  date: string,
  place: string,
  stage?: string | null
): string => {
  const venue = trim(stage);
  if (venue) {
    return `Concerts on ${toDisplayDate(date)} at ${venue}, ${place}`;
  }

  return `Concerts on ${toDisplayDate(date)} at ${place}`;
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

const refuseJoinerBillWrite = async (
  client: ConcertsClient,
  eventId: string
): Promise<DomainError | null> => {
  const id = trim(eventId);
  if (!id) {
    return { ruleId: EVENT_RULE.ownership, message: EVENT_RULE_MESSAGE.ownership };
  }

  const { data, error } = await client
    .from('event_members')
    .select('*')
    .eq('event_id', id)
    .maybeSingle();

  if (error) {
    return persistFailed(error);
  }

  if (data) {
    return { ruleId: EVENT_RULE.ownership, message: EVENT_RULE_MESSAGE.ownership };
  }

  return null;
};

const attachOwnerNotes = async (
  client: ConcertsClient,
  concerts: ConcertRecord[]
): Promise<DomainResult<ConcertRecord[]>> => {
  if (concerts.length === 0) {
    return ok([]);
  }

  const ids = concerts.map(concert => concert.id);
  const { data, error } = await client
    .from('concert_notes')
    .select('concert_id, notes')
    .in('concert_id', ids)
    .order('concert_id', { ascending: true });

  if (error) {
    return {
      data: null,
      error: persistFailed(error)
    };
  }

  const notesById = new Map(
    (data ?? []).map(row => [row.concert_id, row.notes ?? null] as const)
  );

  return ok(
    concerts.map(concert => ({
      ...concert,
      notes: notesById.get(concert.id) ?? null
    }))
  );
};

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

const listStagesForEvent = async (
  client: ConcertsClient,
  eventId: string
): Promise<DomainResult<EventStageRecord[]>> => {
  const { data, error } = await client
    .from('event_stages')
    .select('*')
    .eq('event_id', eventId)
    .order('name', { ascending: true });

  if (error) {
    return {
      data: null,
      error: persistFailed(error)
    };
  }

  return ok(data ?? []);
};

const resolvePlaceAndStage = (
  event: EventRecord,
  stages: EventStageRecord[],
  input: { place?: string; stageId?: string | null; stageName?: string | null }
): DomainResult<{ place: string; stageId: string | null; stageName: string | null }> => {
  const submittedPlace = trim(input.place);
  const inheritedPlace = trim(event.place);
  const allowsOverride = eventAllowsPlaceOverride(event);

  if (!allowsOverride && submittedPlace && submittedPlace !== inheritedPlace) {
    return fail(CONCERT_RULE.placeConflict, CONCERT_RULE_MESSAGE.placeConflict);
  }

  const place = allowsOverride && submittedPlace ? submittedPlace : inheritedPlace;
  const stageId = trim(input.stageId) || null;
  const stageName = trim(input.stageName);

  if (stageId) {
    const named = stages.find(stage => stage.id === stageId);
    if (!named) {
      return fail(CONCERT_RULE.stageNotOnEvent, CONCERT_RULE_MESSAGE.stageNotOnEvent);
    }

    return ok({ place, stageId, stageName: named.name });
  }

  if (stageName) {
    const named = stages.find(
      stage => trim(stage.name).toLowerCase() === stageName.toLowerCase()
    );
    if (named) {
      return ok({ place, stageId: named.id, stageName: named.name });
    }

    return ok({ place, stageId: null, stageName });
  }

  return ok({ place, stageId: null, stageName: null });
};

const ensureEventStage = async (
  client: ConcertsClient,
  eventId: string,
  stages: EventStageRecord[],
  stageId: string | null,
  stageName: string | null
): Promise<DomainResult<{ stageId: string | null; stageName: string | null }>> => {
  if (stageId) {
    const named = stages.find(stage => stage.id === stageId);
    if (!named) {
      return fail(CONCERT_RULE.stageNotOnEvent, CONCERT_RULE_MESSAGE.stageNotOnEvent);
    }

    return ok({ stageId, stageName: named.name });
  }

  const name = trim(stageName);
  if (!name) {
    return ok({ stageId: null, stageName: null });
  }

  const existing = stages.find(
    stage => trim(stage.name).toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    return ok({ stageId: existing.id, stageName: existing.name });
  }

  const { data, error } = await client
    .from('event_stages')
    .insert({ event_id: eventId, name })
    .select('*')
    .single();

  if (error || !data) {
    return {
      data: null,
      error: persistFailed(error ?? { message: 'Failed to save Stage or Scene' })
    };
  }

  return ok({ stageId: data.id, stageName: data.name });
};

const mapConcertKernelError = (error: QueryError): DomainError => {
  const text = constraintText(error);
  if (/this date is outside the event/i.test(text)) {
    return { ruleId: CONCERT_RULE.dateOutsideEvent, message: text };
  }
  if (/this place conflicts with the event place/i.test(text)) {
    return { ruleId: CONCERT_RULE.placeConflict, message: CONCERT_RULE_MESSAGE.placeConflict };
  }
  if (/stage or scene is required/i.test(text)) {
    return { ruleId: CONCERT_RULE.requiredStage, message: CONCERT_RULE_MESSAGE.requiredStage };
  }
  if (/stage or scene must be on this event/i.test(text)) {
    return { ruleId: CONCERT_RULE.stageNotOnEvent, message: CONCERT_RULE_MESSAGE.stageNotOnEvent };
  }
  if (/you do not own this event/i.test(text)) {
    return { ruleId: EVENT_RULE.ownership, message: EVENT_RULE_MESSAGE.ownership };
  }

  return persistFailed(error);
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

const sameStageName = (left: string | null | undefined, right: string | null | undefined) => {
  return trim(left).toLowerCase() === trim(right).toLowerCase();
};

/** Keep `stage_id` only when both stage fields are omitted. A submitted `stageName` (including null) wins. */
const inheritStageId = (
  input: { stageId?: string | null; stageName?: string | null },
  existingStageId: string | null | undefined
): string | null | undefined => {
  if (input.stageId !== undefined) {
    return input.stageId;
  }

  if (input.stageName !== undefined) {
    return null;
  }

  return existingStageId;
};

const draftStageLabel = (
  input: { stageId?: string | null; stageName?: string | null },
  stages: EventStageRecord[]
): string | null => {
  const named = trim(input.stageName);
  if (named) {
    return named;
  }

  const stageId = trim(input.stageId);
  if (!stageId) {
    return null;
  }

  return stages.find(stage => stage.id === stageId)?.name ?? null;
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
  const byDate = client.from('concerts').select(CONCERT_VISIBLE_COLUMNS).eq('date', date);
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
  draftTime: string | null,
  draftStageName: string | null
): ConcertRecord | null => {
  if (!draftTime) {
    return null;
  }

  return (
    candidates.find((concert) => {
      const existingTime = normalizeClock(concert.time);
      return existingTime !== null
        && existingTime === draftTime
        && sameStageName(concert.stage_name, draftStageName);
    }) ?? null
  );
};

const untimedOverlap = (
  candidates: ConcertRecord[],
  draftTime: string | null,
  draftStageName: string | null
): ConcertRecord[] => {
  return candidates.filter((concert) => {
    const existingTime = normalizeClock(concert.time);
    const timeOverlaps = draftTime === null || existingTime === null;
    return timeOverlaps && sameStageName(concert.stage_name, draftStageName);
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

type IdentityDecision
  = { kind: 'return'; result: CreateConcertResult }
    | { kind: 'attach'; target: ConcertRecord }
    | { kind: 'proceed' };

const decideIdentity = (
  candidates: ConcertRecord[],
  draftTime: string | null,
  targetPlace: string,
  draftStageName: string | null,
  confirm?: ConcertIdentityConfirm
): IdentityDecision => {
  const exactTimed = timedMatch(candidates, draftTime, draftStageName);
  if (exactTimed) {
    return { kind: 'return', result: concludeTimedMatch(exactTimed, targetPlace) };
  }

  const overlap = untimedOverlap(candidates, draftTime, draftStageName);
  if (overlap.length > 0 && confirm !== 'create') {
    const existing = pickAttachTarget(overlap, draftTime);
    if (existing && confirm === 'attach') {
      return { kind: 'attach', target: existing };
    }

    return {
      kind: 'return',
      result: {
        data: existing ?? null,
        error: null,
        outcome: CONCERT_IDENTITY.needsChoice
      }
    };
  }

  return { kind: 'proceed' };
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
    .select(CONCERT_VISIBLE_COLUMNS)
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

    const raced = timedMatch(retry.data ?? [], draftTime, existing.stage_name ?? null);
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

const rollbackNewConcert = async (client: ConcertsClient, concertId: string | null) => {
  if (!concertId) {
    return;
  }

  await client.from('concerts').delete().eq('id', concertId);
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

const applyOwnerAttendanceDefault = async (
  client: ConcertsClient,
  concert: ConcertRecord
): Promise<CreateConcertResult | null> => {
  const result = await setAttendance(client as unknown as AttendanceClient, {
    concertId: concert.id,
    status: isConcertPast(concert) ? 'attended' : 'going'
  });

  if (result.error) {
    return failCreate(result.error.ruleId, result.error.message);
  }

  return null;
};

const inheritNightGoingIfSiblingAttending = async (
  client: ConcertsClient,
  event: EventRecord,
  concert: ConcertRecord
): Promise<CreateConcertResult | null> => {
  if (event.kind !== 'single_night') {
    return null;
  }

  const siblingsResult = await client
    .from('concerts')
    .select(CONCERT_VISIBLE_COLUMNS)
    .eq('event_id', event.id)
    .order('date', { ascending: true });

  if (siblingsResult.error) {
    return failCreate('list_failed', siblingsResult.error.message);
  }

  const siblingIds = (siblingsResult.data ?? [])
    .map(row => row.id)
    .filter(id => id !== concert.id);
  if (!siblingIds.length) {
    return null;
  }

  const listed = await listMyAttendance(client as unknown as AttendanceClient);
  if (listed.error) {
    return failCreate(listed.error.ruleId, listed.error.message);
  }

  const siblingHasAttendance = (listed.data ?? []).some((row) => {
    return siblingIds.includes(row.concert_id)
      && (row.status === 'going' || row.status === 'attended');
  });
  if (!siblingHasAttendance) {
    return null;
  }

  return applyOwnerAttendanceDefault(client, concert);
};

export const createConcert = async (
  client: ConcertsClient,
  input: CreateConcertInput
): Promise<CreateConcertResult> => {
  const artist = trim(input.artist);
  if (!artist) {
    return failCreate(CONCERT_RULE.requiredArtist, CONCERT_RULE_MESSAGE.requiredArtist);
  }

  const festival = input.newEvent;
  if (festival?.kind === 'festival') {
    const startDate = trim(festival.startDate);
    const endDate = trim(festival.endDate);
    if (
      startDate
      && CIVIL_DATE.test(startDate)
      && endDate
      && CIVIL_DATE.test(endDate)
      && endDate < startDate
    ) {
      return failCreate(EVENT_RULE.dateOrder, EVENT_RULE_MESSAGE.dateOrder);
    }
  }

  const date = trim(input.date);
  if (!date || !CIVIL_DATE.test(date)) {
    return failCreate(CONCERT_RULE.requiredDate, CONCERT_RULE_MESSAGE.requiredDate);
  }

  const isTransparent = !trim(input.eventId) && !input.newEvent;
  let request = input;

  if (isTransparent) {
    const place = trim(input.place);
    if (!place) {
      return failCreate(CONCERT_RULE.requiredPlace, CONCERT_RULE_MESSAGE.requiredPlace);
    }

    request = {
      ...input,
      newEvent: {
        kind: 'single_night',
        name: transparentSingleNightName(date, place, input.stageName),
        startDate: date,
        place
      }
    };
  }

  if (request.newEvent) {
    const plannedRange = eventRangeFromCreateInput(request.newEvent);
    if (plannedRange && !isDateInsideEvent(date, plannedRange)) {
      return failCreate(
        CONCERT_RULE.dateOutsideEvent,
        dateOutsideEventMessage(plannedRange)
      );
    }
  }

  if (
    request.newEvent?.kind === 'single_night'
    && !trim(request.newEvent.name)
  ) {
    request = {
      ...request,
      newEvent: {
        ...request.newEvent,
        name: transparentSingleNightName(
          request.newEvent.startDate,
          request.newEvent.place,
          request.stageName
        )
      }
    };
  }

  const draftTime = normalizeClock(request.time);
  const target = await resolveTarget(client, request);
  if (target.error || !target.data) {
    return {
      data: null,
      error: target.error,
      outcome: null
    };
  }

  if (target.data.event) {
    const joinerRefuse = await refuseJoinerBillWrite(client, target.data.event.id);
    if (joinerRefuse) {
      return {
        data: null,
        error: joinerRefuse,
        outcome: null
      };
    }
  }

  const earlyStages = target.data.event
    ? await listStagesForEvent(client, target.data.event.id)
    : ok([] as EventStageRecord[]);
  if (earlyStages.error) {
    return {
      data: null,
      error: earlyStages.error,
      outcome: null
    };
  }

  const draftStageName = request.newEvent?.kind === 'festival'
    ? null
    : draftStageLabel(request, earlyStages.data ?? []);

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
  const decision = decideIdentity(
    candidates,
    draftTime,
    target.data.place,
    draftStageName,
    request.confirm
  );
  if (decision.kind === 'return') {
    return decision.result;
  }

  if (decision.kind === 'attach') {
    return writeAttachTime(client, decision.target, draftTime, target.data.place);
  }

  let event = target.data.event;
  let createdEventId: string | null = null;

  if (request.newEvent) {
    const created = await createEvent(client as unknown as EventsClient, request.newEvent);
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

  const stagesResult = await listStagesForEvent(client, event.id);
  if (stagesResult.error) {
    await rollbackNewEvent(client, createdEventId);
    return {
      data: null,
      error: stagesResult.error,
      outcome: null
    };
  }

  const placement = resolvePlaceAndStage(event, stagesResult.data ?? [], {
    place: request.place,
    stageId: request.stageId,
    stageName: request.stageName
  });
  if (placement.error || !placement.data) {
    await rollbackNewEvent(client, createdEventId);
    return failCreate(
      placement.error?.ruleId ?? CONCERT_RULE.requiredStage,
      placement.error?.message ?? CONCERT_RULE_MESSAGE.requiredStage
    );
  }

  const stageRow = request.newEvent?.kind === 'festival'
    ? ok({ stageId: null, stageName: null })
    : await ensureEventStage(
        client,
        event.id,
        stagesResult.data ?? [],
        placement.data.stageId,
        placement.data.stageName
      );
  if (stageRow.error || !stageRow.data) {
    await rollbackNewEvent(client, createdEventId);
    return failCreate(
      stageRow.error?.ruleId ?? 'persist_failed',
      stageRow.error?.message ?? 'Failed to save Stage or Scene'
    );
  }

  const payload = {
    event_id: event.id,
    artist,
    date,
    time: draftTime,
    place: placement.data.place,
    stage_id: stageRow.data.stageId,
    stage_name: stageRow.data.stageName
  };

  const { data, error } = await client.from('concerts').insert(payload).select(CONCERT_VISIBLE_COLUMNS).single();

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

      const raced = timedMatch(retry.data ?? [], draftTime, draftStageName);
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
        error: mapConcertKernelError(error),
        outcome: null
      };
    }

    return failCreate('persist_failed', 'Failed to create concert');
  }

  if (createdEventId && request.newEvent?.kind === 'single_night') {
    const attendanceError = await applyOwnerAttendanceDefault(client, data);
    if (attendanceError) {
      await rollbackNewConcert(client, data.id);
      await rollbackNewEvent(client, createdEventId);
      return attendanceError;
    }
  } else {
    const inherited = await inheritNightGoingIfSiblingAttending(client, event, data);
    if (inherited) {
      await rollbackNewConcert(client, data.id);
      return inherited;
    }
  }

  return okCreate(data, CONCERT_IDENTITY.created);
};

const optionalNotes = (value: string | null | undefined): string | null => {
  const notes = trim(value);
  return notes || null;
};

const loadConcert = async (
  client: ConcertsClient,
  concertId: string
): Promise<DomainResult<ConcertRecord>> => {
  const id = trim(concertId);
  if (!id) {
    return fail(CONCERT_RULE.ownership, CONCERT_RULE_MESSAGE.ownership);
  }

  const { data, error } = await client.from('concerts').select(CONCERT_VISIBLE_COLUMNS).eq('id', id).maybeSingle();
  if (error) {
    return {
      data: null,
      error: persistFailed(error)
    };
  }

  if (!data) {
    return fail(CONCERT_RULE.ownership, CONCERT_RULE_MESSAGE.ownership);
  }

  const withNotes = await attachOwnerNotes(client, [data]);
  if (withNotes.error || !withNotes.data?.[0]) {
    return {
      data: null,
      error: withNotes.error
    };
  }

  return ok(withNotes.data[0]);
};

export const updateConcert = async (
  client: ConcertsClient,
  input: UpdateConcertInput
): Promise<CreateConcertResult> => {
  const artist = trim(input.artist);
  if (!artist) {
    return failCreate(CONCERT_RULE.requiredArtist, CONCERT_RULE_MESSAGE.requiredArtist);
  }

  const date = trim(input.date);
  if (!date || !CIVIL_DATE.test(date)) {
    return failCreate(CONCERT_RULE.requiredDate, CONCERT_RULE_MESSAGE.requiredDate);
  }

  const existing = await loadConcert(client, input.concertId);
  if (existing.error || !existing.data) {
    return {
      data: null,
      error: existing.error,
      outcome: null
    };
  }

  const current = existing.data;
  const joinerRefuse = await refuseJoinerBillWrite(client, current.event_id);
  if (joinerRefuse) {
    return {
      data: null,
      error: joinerRefuse,
      outcome: null
    };
  }

  const requestedEventId = trim(input.eventId);
  const targetEventId = requestedEventId || current.event_id;

  const eventResult = await resolveEvent(client, {
    artist,
    date,
    eventId: targetEventId
  });
  if (eventResult.error || !eventResult.data) {
    return {
      data: null,
      error: eventResult.error,
      outcome: null
    };
  }

  if (eventResult.data.id !== current.event_id && eventResult.data.owner_id !== current.owner_id) {
    return failCreate(EVENT_RULE.ownership, EVENT_RULE_MESSAGE.ownership);
  }

  if (!isDateInsideEvent(date, eventResult.data)) {
    return failCreate(CONCERT_RULE.dateOutsideEvent, dateOutsideEventMessage(eventResult.data));
  }

  const stagesResult = await listStagesForEvent(client, eventResult.data.id);
  if (stagesResult.error) {
    return { data: null, error: stagesResult.error, outcome: null };
  }

  const draftTime = normalizeClock(input.time);
  const placement = resolvePlaceAndStage(eventResult.data, stagesResult.data ?? [], {
    place: input.place,
    stageId: inheritStageId(input, current.stage_id),
    stageName: input.stageName
  });
  if (placement.error || !placement.data) {
    return { data: null, error: placement.error, outcome: null };
  }

  const nextStageName = placement.data.stageName;
  const identityUnchanged
    = sameArtist(current.artist, artist)
      && current.date === date
      && normalizeClock(current.time) === draftTime
      && sameStageName(current.stage_name, nextStageName);

  if (!identityUnchanged) {
    const candidatesResult = await listIdentityCandidates(
      client,
      artist,
      date,
      current.owner_id
    );
    if (candidatesResult.error) {
      return {
        data: null,
        error: candidatesResult.error,
        outcome: null
      };
    }

    const candidates = (candidatesResult.data ?? []).filter(
      concert => concert.id !== current.id
    );
    const decision = decideIdentity(
      candidates,
      draftTime,
      eventResult.data.place,
      nextStageName,
      input.confirm
    );
    if (decision.kind === 'return') {
      return decision.result;
    }

    if (decision.kind === 'attach') {
      return writeAttachTime(client, decision.target, draftTime, eventResult.data.place);
    }
  }

  const stageRow = await ensureEventStage(
    client,
    eventResult.data.id,
    stagesResult.data ?? [],
    placement.data.stageId,
    placement.data.stageName
  );
  if (stageRow.error || !stageRow.data) {
    return { data: null, error: stageRow.error, outcome: null };
  }

  const payload = {
    artist,
    date,
    time: draftTime,
    place: placement.data.place,
    stage_id: stageRow.data.stageId,
    stage_name: stageRow.data.stageName,
    notes: optionalNotes(input.notes),
    ...(eventResult.data.id !== current.event_id ? { event_id: eventResult.data.id } : {})
  };

  const { data, error } = await client
    .from('concerts')
    .update(payload)
    .eq('id', current.id)
    .select(CONCERT_VISIBLE_COLUMNS)
    .single();

  if (error || !data) {
    if (error && isUniqueViolation(error)) {
      const retry = await listIdentityCandidates(
        client,
        artist,
        date,
        current.owner_id
      );
      if (retry.error) {
        return {
          data: null,
          error: retry.error,
          outcome: null
        };
      }

      const raced = timedMatch(
        (retry.data ?? []).filter(concert => concert.id !== current.id),
        draftTime,
        nextStageName
      );
      if (raced) {
        return concludeTimedMatch(raced, eventResult.data.place);
      }

      return failCreate(
        CONCERT_RULE.impossiblePlace,
        CONCERT_RULE_MESSAGE.impossiblePlace,
        CONCERT_IDENTITY.impossiblePlace
      );
    }

    return {
      data: null,
      error: error ? mapConcertKernelError(error) : persistFailed({ message: 'Failed to update concert' }),
      outcome: null
    };
  }

  return {
    data: {
      ...data,
      notes: optionalNotes(input.notes)
    },
    error: null,
    outcome: null
  };
};

export const moveConcert = async (
  client: ConcertsClient,
  input: MoveConcertInput
): Promise<DomainResult<ConcertRecord>> => {
  const existing = await loadConcert(client, input.concertId);
  if (existing.error || !existing.data) {
    return existing;
  }

  const joinerRefuse = await refuseJoinerBillWrite(client, existing.data.event_id);
  if (joinerRefuse) {
    return { data: null, error: joinerRefuse };
  }

  const targetEventId = trim(input.targetEventId);
  if (!targetEventId) {
    return fail(CONCERT_RULE.requiredEvent, CONCERT_RULE_MESSAGE.requiredEvent);
  }

  if (targetEventId === existing.data.event_id) {
    return ok(existing.data);
  }

  const eventResult = await resolveEvent(client, {
    artist: existing.data.artist,
    date: existing.data.date,
    eventId: targetEventId
  });
  if (eventResult.error || !eventResult.data) {
    return {
      data: null,
      error: eventResult.error
    };
  }

  if (eventResult.data.owner_id !== existing.data.owner_id) {
    return fail(EVENT_RULE.ownership, EVENT_RULE_MESSAGE.ownership);
  }

  if (!isDateInsideEvent(existing.data.date, eventResult.data)) {
    return fail(CONCERT_RULE.dateOutsideEvent, dateOutsideEventMessage(eventResult.data));
  }

  const stagesResult = await listStagesForEvent(client, eventResult.data.id);
  if (stagesResult.error) {
    return { data: null, error: stagesResult.error };
  }

  const placement = resolvePlaceAndStage(eventResult.data, stagesResult.data ?? [], {
    place: input.place === undefined ? existing.data.place : input.place,
    stageId: input.stageId === undefined ? existing.data.stage_id : input.stageId,
    stageName: input.stageName === undefined ? existing.data.stage_name : input.stageName
  });
  if (placement.error || !placement.data) {
    return { data: null, error: placement.error };
  }

  const stageRow = await ensureEventStage(
    client,
    eventResult.data.id,
    stagesResult.data ?? [],
    placement.data.stageId,
    placement.data.stageName
  );
  if (stageRow.error || !stageRow.data) {
    return { data: null, error: stageRow.error };
  }

  const payload = {
    event_id: eventResult.data.id,
    place: placement.data.place,
    stage_id: stageRow.data.stageId,
    stage_name: stageRow.data.stageName
  };

  const { data, error } = await client
    .from('concerts')
    .update(payload)
    .eq('id', existing.data.id)
    .select(CONCERT_VISIBLE_COLUMNS)
    .single();

  if (error || !data) {
    return {
      data: null,
      error: error ? mapConcertKernelError(error) : persistFailed({ message: 'Failed to move concert' })
    };
  }

  return ok(data);
};

export const deleteConcert = async (
  client: ConcertsClient,
  concertId: string
): Promise<DomainResult<{ id: string; event_id: string }>> => {
  const existing = await loadConcert(client, concertId);
  if (existing.error || !existing.data) {
    return {
      data: null,
      error: existing.error
    };
  }

  const joinerRefuse = await refuseJoinerBillWrite(client, existing.data.event_id);
  if (joinerRefuse) {
    return { data: null, error: joinerRefuse };
  }

  const { error } = await client.from('concerts').delete().eq('id', existing.data.id);
  if (error) {
    return {
      data: null,
      error: persistFailed(error)
    };
  }

  return ok({
    id: existing.data.id,
    event_id: existing.data.event_id
  });
};

export const listConcertsForEvent = async (
  client: ConcertsClient,
  eventId: string
): Promise<DomainResult<ConcertRecord[]>> => {
  const id = trim(eventId);
  if (!id) {
    return ok([]);
  }

  const { data, error } = await client.from('concerts').select(CONCERT_VISIBLE_COLUMNS).eq('event_id', id).order('date', { ascending: true });

  if (error) {
    return {
      data: null,
      error: {
        ruleId: 'list_failed',
        message: error.message
      }
    };
  }

  const withNotes = await attachOwnerNotes(client, data ?? []);
  if (withNotes.error || !withNotes.data) {
    return {
      data: null,
      error: withNotes.error
    };
  }

  return ok(sortConcerts(withNotes.data));
};

export const EVENTS_LIST_WINDOW = 20;

export const nextEventsListWindowEnd = (
  listLength: number,
  currentEnd: number,
  pageSize = EVENTS_LIST_WINDOW
) => {
  const onePage = Math.min(pageSize, listLength);
  return Math.max(onePage, Math.min(Math.max(currentEnd, 0), listLength));
};

export const listConcertsForEventIds = async (
  client: ConcertsClient,
  eventIds: string[]
): Promise<DomainResult<ConcertRecord[]>> => {
  const ids = [...new Set(eventIds.map(id => trim(id)).filter(Boolean))];
  if (ids.length === 0) {
    return ok([]);
  }

  const { data, error } = await client
    .from('concerts')
    .select(CONCERT_VISIBLE_COLUMNS)
    .in('event_id', ids)
    .order('date', { ascending: true });

  if (error) {
    return {
      data: null,
      error: {
        ruleId: 'list_failed',
        message: error.message
      }
    };
  }

  const withNotes = await attachOwnerNotes(client, data ?? []);
  if (withNotes.error || !withNotes.data) {
    return {
      data: null,
      error: withNotes.error
    };
  }

  return ok(sortConcerts(withNotes.data));
};

export const listOwnedConcerts = async (
  client: ConcertsClient
): Promise<DomainResult<ConcertRecord[]>> => {
  const { data, error } = await client.from('concerts').select(CONCERT_VISIBLE_COLUMNS).order('date', { ascending: true });

  if (error) {
    return {
      data: null,
      error: {
        ruleId: 'list_failed',
        message: error.message
      }
    };
  }

  const withNotes = await attachOwnerNotes(client, data ?? []);
  if (withNotes.error || !withNotes.data) {
    return {
      data: null,
      error: withNotes.error
    };
  }

  return ok(sortConcerts(withNotes.data));
};

export const listConcertEventIds = async (
  client: ConcertsClient
): Promise<DomainResult<Array<{ id: string; event_id: string }>>> => {
  const { data, error } = await client
    .from('concerts')
    .select('id, event_id')
    .order('date', { ascending: true });

  if (error) {
    return {
      data: null,
      error: {
        ruleId: 'list_failed',
        message: error.message
      }
    };
  }

  return ok((data ?? []).map(row => ({ id: row.id, event_id: row.event_id })));
};
