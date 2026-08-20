import { getOwnedEvent, type DomainResult, type EventMemberRecord, type EventsClient } from './events';

export type { EventMemberRecord };

export const MEMBERSHIP_RULE = {
  ownerCannotLeave: 'owner_cannot_leave',
  leaveFailed: 'leave_failed',
  joinerImpactLookupFailed: 'joiner_impact_lookup_failed'
} as const;

export const MEMBERSHIP_RULE_MESSAGE = {
  ownerCannotLeave: 'You cannot leave an Event you own.'
} as const;

export const JOINER_IMPACT_COPY = {
  deleteConcert: 'Joiners will lose this Concert and their Attendance on it.',
  moveConcert: 'Joiners of this Event who have not joined the target will lose this Concert from their Bill. They will not be added to the target Event.',
  deleteEvent: 'Joiners will lose this Event, its Concerts, and their Attendance.',
  deleteEmptyEvent: 'Joiners will lose this Event.'
} as const;

type QueryError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

const trim = (value: string | undefined) => (value ?? '').trim();

const constraintText = (error: QueryError): string => {
  return [error.message, error.details, error.hint].filter(Boolean).join(' ');
};

const isUniqueViolation = (error: QueryError) => {
  return error.code === '23505' || /duplicate key|unique constraint/i.test(constraintText(error));
};

const isQuietNotFound = (error: QueryError) => {
  return (
    error.code === '22P02'
    || /event not found/i.test(constraintText(error))
    || /invalid input syntax/i.test(constraintText(error))
  );
};

export const joinEvent = async (
  client: EventsClient,
  eventId: string
): Promise<DomainResult<EventMemberRecord | true>> => {
  const id = trim(eventId);
  if (!id) {
    return { data: null, error: null };
  }

  const { data, error } = await client
    .from('event_members')
    .insert({ event_id: id })
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      return { data: true, error: null };
    }

    if (isQuietNotFound(error)) {
      return { data: null, error: null };
    }

    return {
      data: null,
      error: {
        ruleId: 'join_failed',
        message: error.message
      }
    };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return { data, error: null };
};

export const leaveEvent = async (
  client: EventsClient,
  eventId: string
): Promise<DomainResult<true>> => {
  const id = trim(eventId);
  if (!id) {
    return { data: null, error: null };
  }

  const event = await getOwnedEvent(client, id);
  if (event.error) {
    return { data: null, error: event.error };
  }

  if (!event.data) {
    return { data: null, error: null };
  }

  const membership = await client
    .from('event_members')
    .select('*')
    .eq('event_id', id)
    .maybeSingle();

  if (membership.error) {
    return {
      data: null,
      error: {
        ruleId: MEMBERSHIP_RULE.leaveFailed,
        message: membership.error.message
      }
    };
  }

  if (!membership.data) {
    return {
      data: null,
      error: {
        ruleId: MEMBERSHIP_RULE.ownerCannotLeave,
        message: MEMBERSHIP_RULE_MESSAGE.ownerCannotLeave
      }
    };
  }

  const { error } = await client.from('event_members').delete().eq('event_id', id);
  if (error) {
    return {
      data: null,
      error: {
        ruleId: MEMBERSHIP_RULE.leaveFailed,
        message: error.message
      }
    };
  }

  return { data: true, error: null };
};

export const eventHasJoiners = async (
  client: EventsClient,
  eventId: string
): Promise<DomainResult<boolean>> => {
  const id = trim(eventId);
  if (!id) {
    return { data: false, error: null };
  }

  const { data, error } = await client.rpc('event_has_joiners', { p_event_id: id });
  if (error) {
    return {
      data: null,
      error: {
        ruleId: MEMBERSHIP_RULE.joinerImpactLookupFailed,
        message: error.message
      }
    };
  }

  return { data: Boolean(data), error: null };
};

export const concertMoveWouldLoseJoiners = async (
  client: EventsClient,
  sourceEventId: string,
  targetEventId: string
): Promise<DomainResult<boolean>> => {
  const sourceId = trim(sourceEventId);
  const targetId = trim(targetEventId);
  if (!sourceId || !targetId) {
    return { data: false, error: null };
  }

  const { data, error } = await client.rpc('concert_move_would_lose_joiners', {
    p_source_event_id: sourceId,
    p_target_event_id: targetId
  });
  if (error) {
    return {
      data: null,
      error: {
        ruleId: MEMBERSHIP_RULE.joinerImpactLookupFailed,
        message: error.message
      }
    };
  }

  return { data: Boolean(data), error: null };
};
