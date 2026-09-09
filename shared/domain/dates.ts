export const PARIS_TIME_ZONE = 'Europe/Paris';

export const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const DATE_OUTSIDE_EVENT = 'This date is outside the Event.';

export const civilDateInTimeZone = (now: Date, timeZone: string): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
};

export const formatCivilDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) {
    return iso;
  }

  return `${day}/${month}/${year}`;
};

export const formatEventDateRange = (startDate: string, endDate: string): string => {
  if (startDate === endDate) {
    return formatCivilDate(startDate);
  }

  return `${formatCivilDate(startDate)} – ${formatCivilDate(endDate)}`;
};

export const dateOutsideEventMessage = (
  event: { start_date: string; end_date: string }
): string => {
  return `${DATE_OUTSIDE_EVENT} ${formatEventDateRange(event.start_date, event.end_date)}`;
};
