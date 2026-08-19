import type { EventRecord } from '#shared/domain/events';

const toDisplayDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) {
    return iso;
  }

  return `${day}/${month}/${year}`;
};

export const formatEventDateLabel = (event: EventRecord): string => {
  if (event.start_date === event.end_date) {
    return toDisplayDate(event.start_date);
  }

  return `${toDisplayDate(event.start_date)} – ${toDisplayDate(event.end_date)}`;
};
