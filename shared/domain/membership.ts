import type { DomainResult, EventMemberRecord, EventsClient } from './events';

export type { EventMemberRecord };

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
