import type { EventRecord } from '#shared/domain/events';
import { CIVIL_DATE, formatCivilDate, formatEventDateRange } from '#shared/domain/dates';

export { formatCivilDate };

export type DateStackParts = {
  weekday: string;
  day: string;
  month: string;
  year: string;
  range: boolean;
};

const RANGE_DASH = '–';

const stackPart = (date: Date, options: Intl.DateTimeFormatOptions) => {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(date).toUpperCase();
};

const singleDateStack = (iso: string): DateStackParts => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (!CIVIL_DATE.test(iso) || Number.isNaN(date.getTime())) {
    return { weekday: '', day: iso, month: '', year: '', range: false };
  }

  return {
    weekday: stackPart(date, { weekday: 'short' }),
    day: stackPart(date, { day: 'numeric' }),
    // en-GB renders September as "Sept"; the stack column fits three letters.
    month: stackPart(date, { month: 'short' }).slice(0, 3),
    year: stackPart(date, { year: 'numeric' }),
    range: false
  };
};

export const formatDateStack = (start: string, end?: string): DateStackParts => {
  const startParts = singleDateStack(start);
  if (!end || end === start || !startParts.weekday || !CIVIL_DATE.test(end) || end < start) {
    return startParts;
  }

  const endParts = singleDateStack(end);
  if (!endParts.weekday) {
    return startParts;
  }

  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);

  return {
    weekday: sameMonth ? '' : (sameYear ? startParts.year : `${startParts.year}${RANGE_DASH}${endParts.year}`),
    day: `${startParts.day}${RANGE_DASH}${endParts.day}`,
    month: sameMonth ? startParts.month : `${startParts.month}${RANGE_DASH}${endParts.month}`,
    year: sameYear ? startParts.year : `${startParts.year}${RANGE_DASH}${endParts.year}`,
    range: true
  };
};

export const formatEventDateLabel = (event: Pick<EventRecord, 'start_date' | 'end_date'>): string => {
  return formatEventDateRange(event.start_date, event.end_date);
};
