import type { EventRecord } from '#shared/domain/events';
import { formatCivilDate, formatEventDateRange } from '#shared/domain/dates';

export { formatCivilDate };

export const formatEventDateLabel = (event: Pick<EventRecord, 'start_date' | 'end_date'>): string => {
  return formatEventDateRange(event.start_date, event.end_date);
};
