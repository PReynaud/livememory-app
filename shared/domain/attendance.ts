import { civilDateInTimeZone, PARIS_TIME_ZONE, type DomainError, type DomainResult } from './events';

export const ATTENDANCE_STATUS = {
  going: 'going',
  attended: 'attended'
} as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

export const ATTENDANCE_RULE = {
  futureAttended: 'future_attended',
  attendedToGoing: 'attended_to_going'
} as const;

export const ATTENDANCE_RULE_MESSAGE = {
  futureAttended: 'Cannot mark a future concert as attended.',
  attendedToGoing: 'Cannot change attended to going.'
} as const;

export type AttendanceRecord = {
  id: string;
  user_id: string;
  concert_id: string;
  status: AttendanceStatus;
};

export type SetAttendanceInput = {
  concertId: string;
  status: AttendanceStatus;
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

type AttendanceTableApi = {
  insert: (values: Record<string, unknown>) => {
    select: () => {
      single: () => Promise<QueryResult<AttendanceRecord>>;
    };
  };
  select: (columns?: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<QueryResult<AttendanceRecord | null>>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      select: () => {
        single: () => Promise<QueryResult<AttendanceRecord>>;
      };
    };
  };
  delete: () => {
    eq: (column: string, value: string) => Promise<QueryResult<null>>;
  };
};

type AttendanceEffectiveApi = {
  select: (columns?: string) => {
    order: (
      column: string,
      options?: { ascending?: boolean }
    ) => Promise<QueryResult<AttendanceRecord[]>>;
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<QueryResult<AttendanceRecord | null>>;
    };
  };
};

export type AttendanceClient = {
  from: {
    (relation: 'attendance'): AttendanceTableApi;
    (relation: 'attendance_effective'): AttendanceEffectiveApi;
  };
};

const trim = (value: string | undefined | null) => (value ?? '').trim();

const fail = <T>(ruleId: string, message: string): DomainResult<T> => ({
  data: null,
  error: { ruleId, message }
});

const ok = <T>(data: T): DomainResult<T> => ({
  data,
  error: null
});

const persistFailed = (error: QueryError): DomainError => ({
  ruleId: 'persist_failed',
  message: error.message
});

const constraintText = (error: QueryError): string => {
  return [error.code, error.message, error.details, error.hint].filter(Boolean).join(' ');
};

const mapWriteError = (error: QueryError): DomainError => {
  const text = constraintText(error);
  if (/future_attended/i.test(text)) {
    return {
      ruleId: ATTENDANCE_RULE.futureAttended,
      message: ATTENDANCE_RULE_MESSAGE.futureAttended
    };
  }

  if (/attended_to_going/i.test(text)) {
    return {
      ruleId: ATTENDANCE_RULE.attendedToGoing,
      message: ATTENDANCE_RULE_MESSAGE.attendedToGoing
    };
  }

  return persistFailed(error);
};

const padTimePart = (value: string | undefined, fallback = '00') => {
  return (value || fallback).padStart(2, '0');
};

const normalizeClock = (value: string): string => {
  const [hour, minute, second] = value.split(':');
  return `${padTimePart(hour)}:${padTimePart(minute)}:${padTimePart(second)}`;
};

const parisDateTime = (now: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);

  const pick = (type: Intl.DateTimeFormatPartTypes) => {
    return parts.find(part => part.type === type)?.value ?? '';
  };

  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}`;
};

export const isConcertPast = (
  concert: { date: string; time: string | null },
  now = new Date()
): boolean => {
  if (!concert.time) {
    return civilDateInTimeZone(now, PARIS_TIME_ZONE) > concert.date;
  }

  return parisDateTime(now) > `${concert.date}T${normalizeClock(concert.time)}`;
};

const readEffective = async (
  client: AttendanceClient,
  concertId: string
): Promise<DomainResult<AttendanceRecord>> => {
  const { data, error } = await client
    .from('attendance_effective')
    .select('*')
    .eq('concert_id', concertId)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: persistFailed(error)
    };
  }

  if (!data) {
    return fail('persist_failed', 'Failed to load attendance');
  }

  return ok(data);
};

export const setAttendance = async (
  client: AttendanceClient,
  input: SetAttendanceInput
): Promise<DomainResult<AttendanceRecord>> => {
  const concertId = trim(input.concertId);
  if (!concertId) {
    return fail('persist_failed', 'Concert is required');
  }

  const status = input.status;
  if (status !== ATTENDANCE_STATUS.going && status !== ATTENDANCE_STATUS.attended) {
    return fail('persist_failed', 'Attendance must be going or attended');
  }

  const existing = await client.from('attendance').select('*').eq('concert_id', concertId).maybeSingle();
  if (existing.error) {
    return {
      data: null,
      error: persistFailed(existing.error)
    };
  }

  if (existing.data) {
    const { error } = await client
      .from('attendance')
      .update({ status })
      .eq('concert_id', concertId)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: mapWriteError(error)
      };
    }
  } else {
    const { error } = await client
      .from('attendance')
      .insert({ concert_id: concertId, status })
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: mapWriteError(error)
      };
    }
  }

  return readEffective(client, concertId);
};

export const clearAttendance = async (
  client: AttendanceClient,
  concertId: string
): Promise<DomainResult<null>> => {
  const id = trim(concertId);
  if (!id) {
    return fail('persist_failed', 'Concert is required');
  }

  const { error } = await client.from('attendance').delete().eq('concert_id', id);
  if (error) {
    return {
      data: null,
      error: persistFailed(error)
    };
  }

  return ok(null);
};

export const listMyAttendance = async (
  client: AttendanceClient
): Promise<DomainResult<AttendanceRecord[]>> => {
  const { data, error } = await client
    .from('attendance_effective')
    .select('*')
    .order('concert_id', { ascending: true });

  if (error) {
    return {
      data: null,
      error: {
        ruleId: 'list_failed',
        message: error.message
      }
    };
  }

  return ok(data ?? []);
};
