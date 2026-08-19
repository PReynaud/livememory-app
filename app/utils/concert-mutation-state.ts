import type { AttendanceStatus } from '#shared/domain/attendance';
import type { ConcertRecord } from '#shared/domain/concerts';

export const upsertConcert = (
  concerts: ConcertRecord[],
  concert: ConcertRecord
): ConcertRecord[] => {
  const replaced = concerts.map(item => (item.id === concert.id ? concert : item));
  return replaced.some(item => item.id === concert.id) ? replaced : [...replaced, concert];
};

export const omitConcert = (
  concerts: ConcertRecord[],
  concertId: string
): ConcertRecord[] => {
  return concerts.filter(item => item.id !== concertId);
};

export const omitAttendanceForConcert = (
  attendanceByConcertId: Record<string, AttendanceStatus>,
  concertId: string
): Record<string, AttendanceStatus> => {
  return Object.fromEntries(
    Object.entries(attendanceByConcertId).filter(([id]) => id !== concertId)
  );
};

export const currentConcertsForEvent = (
  concerts: ConcertRecord[],
  eventId: string | null | undefined
): ConcertRecord[] | null => {
  if (!eventId) {
    return null;
  }

  return concerts.filter(concert => concert.event_id === eventId);
};
