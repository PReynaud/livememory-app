import type { EventRecord } from '#shared/domain/events';

export const formatCivilDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) {
    return iso;
  }

  return `${day}/${month}/${year}`;
};

export const formatEventDateLabel = (event: EventRecord): string => {
  if (event.start_date === event.end_date) {
    return formatCivilDate(event.start_date);
  }

  return `${formatCivilDate(event.start_date)} – ${formatCivilDate(event.end_date)}`;
};
