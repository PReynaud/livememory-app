import {
  attendThisNight,
  clearAttendance,
  listMyAttendance,
  setAttendance,
  type AttendanceClient,
  type AttendanceStatus
} from '#shared/domain/attendance';
import {
  CONCERT_IDENTITY,
  CONCERT_RULE,
  CONCERT_RULE_MESSAGE,
  createConcert,
  deleteConcert,
  listConcertsForEvent,
  listOwnedConcerts,
  moveConcert,
  updateConcert,
  type ConcertCreateOutcome,
  type ConcertIdentityConfirm,
  type ConcertsClient,
  type CreateConcertInput,
  type MoveConcertInput,
  type UpdateConcertInput
} from '#shared/domain/concerts';
import {
  createEvent,
  deleteEvent,
  EVENT_RULE,
  EVENT_RULE_MESSAGE,
  getOwnedEvent,
  listEventStages,
  listOwnedEvents,
  requireEventOwnerAccess,
  updateEvent,
  type CreateEventInput,
  type DomainError,
  type DomainResult,
  type EventKind,
  type EventsClient,
  type UpdateEventInput
} from '#shared/domain/events';
import {
  concertMoveWouldLoseJoiners,
  eventHasJoiners,
  joinEvent,
  JOINER_IMPACT_COPY,
  leaveEvent
} from '#shared/domain/membership';

export const MCP_NEEDS_CONFIRM = 'needs_confirm' as const;

export type McpToolName
  = 'list_events'
    | 'get_event'
    | 'create_event'
    | 'update_event'
    | 'delete_event'
    | 'list_concerts'
    | 'create_concert'
    | 'update_concert'
    | 'move_concert'
    | 'delete_concert'
    | 'list_event_stages'
    | 'list_attendance'
    | 'set_attendance'
    | 'clear_attendance'
    | 'attend_this_night'
    | 'join_event'
    | 'leave_event';

export type McpToolJson = {
  ok: boolean;
  outcome?: ConcertCreateOutcome | typeof MCP_NEEDS_CONFIRM | null;
  ruleId?: string | null;
  message?: string | null;
  confirm?: Array<'attach' | 'create'> | true;
  conflicts?: DomainError['conflicts'];
  data?: unknown;
};

export type LogDomain = {
  listOwnedEvents: typeof listOwnedEvents;
  getOwnedEvent: typeof getOwnedEvent;
  createEvent: typeof createEvent;
  updateEvent: typeof updateEvent;
  deleteEvent: typeof deleteEvent;
  listEventStages: typeof listEventStages;
  listConcertsForEvent: typeof listConcertsForEvent;
  listOwnedConcerts: typeof listOwnedConcerts;
  createConcert: typeof createConcert;
  updateConcert: typeof updateConcert;
  moveConcert: typeof moveConcert;
  deleteConcert: typeof deleteConcert;
  listMyAttendance: typeof listMyAttendance;
  setAttendance: typeof setAttendance;
  clearAttendance: typeof clearAttendance;
  attendThisNight: typeof attendThisNight;
  eventHasJoiners: typeof eventHasJoiners;
  concertMoveWouldLoseJoiners: typeof concertMoveWouldLoseJoiners;
  joinEvent: typeof joinEvent;
  leaveEvent: typeof leaveEvent;
  requireEventOwnerAccess: typeof requireEventOwnerAccess;
};

export const liveMemoryLogDomain: LogDomain = {
  listOwnedEvents,
  getOwnedEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listEventStages,
  listConcertsForEvent,
  listOwnedConcerts,
  createConcert,
  updateConcert,
  moveConcert,
  deleteConcert,
  listMyAttendance,
  setAttendance,
  clearAttendance,
  attendThisNight,
  eventHasJoiners,
  concertMoveWouldLoseJoiners,
  joinEvent,
  leaveEvent,
  requireEventOwnerAccess
};

const asString = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

const asOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const asNullableString = (value: unknown): string | null | undefined => {
  if (value === null) {
    return null;
  }

  return typeof value === 'string' ? value : undefined;
};

const asBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const asEventKind = (value: unknown): EventKind | '' => {
  return value === 'single_night' || value === 'festival' ? value : '';
};

const asConfirmChoice = (value: unknown): ConcertIdentityConfirm | undefined => {
  return value === 'attach' || value === 'create' ? value : undefined;
};

const asAttendanceStatus = (value: unknown): AttendanceStatus | '' => {
  return value === 'going' || value === 'attended' ? value : '';
};

const okJson = (data: unknown, outcome?: ConcertCreateOutcome | null): McpToolJson => ({
  ok: true,
  outcome: outcome ?? null,
  data
});

const failJson = (
  error: DomainError | null | undefined,
  outcome?: ConcertCreateOutcome | typeof MCP_NEEDS_CONFIRM | null
): McpToolJson => ({
  ok: false,
  outcome: outcome ?? null,
  ruleId: error?.ruleId ?? 'failed',
  message: error?.message ?? 'The request failed.',
  conflicts: error?.conflicts
});

const fromDomain = <T>(
  result: DomainResult<T>,
  outcome?: ConcertCreateOutcome | null
): McpToolJson => {
  if (result.error) {
    return failJson(result.error, outcome ?? null);
  }

  return okJson(result.data, outcome ?? null);
};

const needsConfirm = (message: string): McpToolJson => ({
  ok: false,
  outcome: MCP_NEEDS_CONFIRM,
  ruleId: MCP_NEEDS_CONFIRM,
  message,
  confirm: true
});

const readCreateEventInput = (args: Record<string, unknown>): CreateEventInput => ({
  kind: asEventKind(args.kind) || 'single_night',
  name: asString(args.name),
  startDate: asString(args.startDate),
  endDate: asOptionalString(args.endDate),
  place: asString(args.place)
});

const readUpdateEventInput = (args: Record<string, unknown>): UpdateEventInput => {
  const stagesRaw = args.stages;
  const concertDatesRaw = args.concertDates;
  const stages = Array.isArray(stagesRaw)
    ? stagesRaw.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') {
          return [];
        }

        const row = entry as { id?: unknown; name?: unknown };
        const name = asString(row.name);
        if (!name) {
          return [];
        }

        return [{
          id: asOptionalString(row.id),
          name
        }];
      })
    : undefined;
  const concertDates = Array.isArray(concertDatesRaw)
    ? concertDatesRaw.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') {
          return [];
        }

        const row = entry as { concertId?: unknown; date?: unknown; stageId?: unknown };
        const concertId = asString(row.concertId);
        const date = asString(row.date);
        if (!concertId || !date) {
          return [];
        }

        return [{
          concertId,
          date,
          stageId: asNullableString(row.stageId)
        }];
      })
    : undefined;

  return {
    eventId: asString(args.eventId),
    name: asString(args.name),
    startDate: asString(args.startDate),
    endDate: asOptionalString(args.endDate),
    place: asString(args.place),
    allowPlaceOverride: asBoolean(args.allowPlaceOverride),
    stages,
    concertDates
  };
};

const readCreateConcertInput = (args: Record<string, unknown>): CreateConcertInput => {
  const newEventRaw = args.newEvent;
  const newEvent = newEventRaw && typeof newEventRaw === 'object'
    ? readCreateEventInput(newEventRaw as Record<string, unknown>)
    : undefined;

  return {
    artist: asString(args.artist),
    date: asString(args.date),
    time: asNullableString(args.time),
    place: asOptionalString(args.place),
    stageId: asNullableString(args.stageId),
    stageName: asNullableString(args.stageName),
    eventId: asOptionalString(args.eventId),
    newEvent,
    confirm: asConfirmChoice(args.confirm)
  };
};

const readUpdateConcertInput = (args: Record<string, unknown>): UpdateConcertInput => ({
  concertId: asString(args.concertId),
  artist: asString(args.artist),
  date: asString(args.date),
  time: asNullableString(args.time),
  notes: asNullableString(args.notes),
  confirm: asConfirmChoice(args.confirm),
  place: asOptionalString(args.place),
  stageId: asNullableString(args.stageId),
  stageName: asNullableString(args.stageName),
  eventId: asOptionalString(args.eventId)
});

const readMoveConcertInput = (args: Record<string, unknown>): MoveConcertInput => ({
  concertId: asString(args.concertId),
  targetEventId: asString(args.targetEventId),
  place: asOptionalString(args.place),
  stageId: asNullableString(args.stageId),
  stageName: asNullableString(args.stageName)
});

const concertIdentityResult = (
  result: DomainResult<unknown> & { outcome: ConcertCreateOutcome | null }
): McpToolJson => {
  if (result.outcome === CONCERT_IDENTITY.needsChoice) {
    return {
      ok: false,
      outcome: CONCERT_IDENTITY.needsChoice,
      ruleId: CONCERT_IDENTITY.needsChoice,
      message: CONCERT_RULE_MESSAGE.needsChoice,
      confirm: ['attach', 'create'],
      data: result.data
    };
  }

  if (result.outcome === CONCERT_IDENTITY.impossiblePlace) {
    return failJson(
      result.error ?? {
        ruleId: CONCERT_IDENTITY.impossiblePlace,
        message: CONCERT_RULE_MESSAGE.impossiblePlace
      },
      CONCERT_IDENTITY.impossiblePlace
    );
  }

  if (result.error) {
    return failJson(result.error, result.outcome);
  }

  return okJson(result.data, result.outcome);
};

export const invokeLogTool = async (
  name: string,
  args: Record<string, unknown>,
  client: unknown,
  domain: LogDomain = liveMemoryLogDomain
): Promise<McpToolJson> => {
  const eventsClient = client as EventsClient;
  const concertsClient = client as ConcertsClient;
  const attendanceClient = client as AttendanceClient;

  switch (name as McpToolName) {
    case 'list_events': {
      return fromDomain(await domain.listOwnedEvents(eventsClient));
    }
    case 'get_event': {
      const eventId = asString(args.eventId);
      const event = await domain.getOwnedEvent(eventsClient, eventId);
      if (event.error) {
        return failJson(event.error);
      }

      const concerts = await domain.listConcertsForEvent(concertsClient, eventId);
      if (concerts.error) {
        return failJson(concerts.error);
      }

      const stages = await domain.listEventStages(eventsClient, eventId);
      if (stages.error) {
        return failJson(stages.error);
      }

      return okJson({
        event: event.data,
        concerts: concerts.data ?? [],
        stages: stages.data ?? []
      });
    }
    case 'create_event': {
      return fromDomain(await domain.createEvent(eventsClient, readCreateEventInput(args)));
    }
    case 'update_event': {
      return fromDomain(await domain.updateEvent(eventsClient, readUpdateEventInput(args)));
    }
    case 'delete_event': {
      const eventId = asString(args.eventId);
      const existing = await domain.getOwnedEvent(eventsClient, eventId);
      if (existing.error) {
        return failJson(existing.error);
      }
      if (!existing.data) {
        return failJson({
          ruleId: EVENT_RULE.ownership,
          message: EVENT_RULE_MESSAGE.ownership
        });
      }

      const ownerRefuse = await domain.requireEventOwnerAccess(eventsClient, existing.data.id);
      if (ownerRefuse) {
        return failJson(ownerRefuse);
      }

      const concerts = await domain.listConcertsForEvent(concertsClient, existing.data.id);
      if (concerts.error) {
        return failJson(concerts.error);
      }

      const joiners = await domain.eventHasJoiners(eventsClient, existing.data.id);
      if (joiners.error) {
        return failJson(joiners.error);
      }

      const hasConcerts = (concerts.data?.length ?? 0) > 0;
      const hasJoiners = joiners.data === true;
      if ((hasConcerts || hasJoiners) && asBoolean(args.confirm) !== true) {
        if (hasConcerts) {
          return needsConfirm(
            hasJoiners
              ? JOINER_IMPACT_COPY.deleteEvent
              : 'This Event and all its Concerts will be deleted.'
          );
        }

        return needsConfirm(JOINER_IMPACT_COPY.deleteEmptyEvent);
      }

      return fromDomain(await domain.deleteEvent(eventsClient, existing.data.id));
    }
    case 'list_concerts': {
      const eventId = asString(args.eventId);
      if (eventId) {
        return fromDomain(await domain.listConcertsForEvent(concertsClient, eventId));
      }

      return fromDomain(await domain.listOwnedConcerts(concertsClient));
    }
    case 'create_concert': {
      return concertIdentityResult(
        await domain.createConcert(concertsClient, readCreateConcertInput(args))
      );
    }
    case 'update_concert': {
      return concertIdentityResult(
        await domain.updateConcert(concertsClient, readUpdateConcertInput(args))
      );
    }
    case 'move_concert': {
      const input = readMoveConcertInput(args);
      const listed = await domain.listOwnedConcerts(concertsClient);
      if (listed.error) {
        return failJson(listed.error);
      }

      const existing = listed.data?.find(row => row.id === input.concertId);
      if (!existing) {
        return failJson({
          ruleId: CONCERT_RULE.ownership,
          message: CONCERT_RULE_MESSAGE.ownership
        });
      }

      const ownerRefuse = await domain.requireEventOwnerAccess(eventsClient, existing.event_id);
      if (ownerRefuse) {
        return failJson(ownerRefuse);
      }

      const impact = await domain.concertMoveWouldLoseJoiners(
        eventsClient,
        existing.event_id,
        input.targetEventId
      );
      if (impact.error) {
        return failJson(impact.error);
      }

      if (impact.data === true && asBoolean(args.confirm) !== true) {
        return needsConfirm(JOINER_IMPACT_COPY.moveConcert);
      }

      return fromDomain(await domain.moveConcert(concertsClient, input));
    }
    case 'delete_concert': {
      const concertId = asString(args.concertId);
      const listed = await domain.listOwnedConcerts(concertsClient);
      if (listed.error) {
        return failJson(listed.error);
      }

      const existing = listed.data?.find(row => row.id === concertId);
      if (!existing) {
        return failJson({
          ruleId: CONCERT_RULE.ownership,
          message: CONCERT_RULE_MESSAGE.ownership
        });
      }

      const ownerRefuse = await domain.requireEventOwnerAccess(eventsClient, existing.event_id);
      if (ownerRefuse) {
        return failJson(ownerRefuse);
      }

      const joiners = await domain.eventHasJoiners(eventsClient, existing.event_id);
      if (joiners.error) {
        return failJson(joiners.error);
      }

      if (joiners.data === true && asBoolean(args.confirm) !== true) {
        return needsConfirm(JOINER_IMPACT_COPY.deleteConcert);
      }

      return fromDomain(await domain.deleteConcert(concertsClient, concertId));
    }
    case 'list_event_stages': {
      return fromDomain(await domain.listEventStages(eventsClient, asString(args.eventId)));
    }
    case 'list_attendance': {
      return fromDomain(await domain.listMyAttendance(attendanceClient));
    }
    case 'set_attendance': {
      const status = asAttendanceStatus(args.status);
      if (!status) {
        return failJson({
          ruleId: 'persist_failed',
          message: 'Attendance must be going or attended'
        });
      }

      return fromDomain(await domain.setAttendance(attendanceClient, {
        concertId: asString(args.concertId),
        status
      }));
    }
    case 'clear_attendance': {
      return fromDomain(await domain.clearAttendance(attendanceClient, asString(args.concertId)));
    }
    case 'attend_this_night': {
      return fromDomain(await domain.attendThisNight(attendanceClient, asString(args.eventId)));
    }
    case 'join_event': {
      return fromDomain(await domain.joinEvent(eventsClient, asString(args.eventId)));
    }
    case 'leave_event': {
      return fromDomain(await domain.leaveEvent(eventsClient, asString(args.eventId)));
    }
    default: {
      return failJson({
        ruleId: 'unknown_tool',
        message: `Unknown tool: ${name}`
      });
    }
  }
};

export const toMcpToolResult = (json: McpToolJson) => {
  const identityChoice = json.outcome === CONCERT_IDENTITY.needsChoice
    || json.outcome === MCP_NEEDS_CONFIRM;

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(json) }],
    isError: json.ok === false && !identityChoice
  };
};
