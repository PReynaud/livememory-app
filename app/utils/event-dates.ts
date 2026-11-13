import type { EventRecord } from '#shared/domain/events';
import { formatCivilDate, formatEventDateRange } from '#shared/domain/dates';

export { formatCivilDate };

export type DateStackParts = {
  weekday: string;
  day: string;
  month: string;
  year: string;
};

const stackPart = (date: Date, options: Intl.DateTimeFormatOptions) => {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(date).toUpperCase();
};

export const formatDateStack = (iso: string): DateStackParts => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(date.getTime())) {
    return { weekday: '', day: iso, month: '', year: '' };
  }

  return {
    weekday: stackPart(date, { weekday: 'short' }),
    day: stackPart(date, { day: 'numeric' }),
    // en-GB renders September as "Sept"; the stack column fits three letters.
    month: stackPart(date, { month: 'short' }).slice(0, 3),
    year: stackPart(date, { year: 'numeric' })
  };
};

export const formatEventDateLabel = (event: Pick<EventRecord, 'start_date' | 'end_date'>): string => {
  return formatEventDateRange(event.start_date, event.end_date);
};
