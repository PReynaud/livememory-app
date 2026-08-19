import type { AttendanceStatus } from './attendance';

export type SouvenirStats = {
  attended: number;
  events: number;
  going: number;
};

export const souvenirStats = (input: {
  ownedEventCount: number;
  statuses: AttendanceStatus[];
}): SouvenirStats => {
  let attended = 0;
  let going = 0;

  for (const status of input.statuses) {
    if (status === 'attended') {
      attended += 1;
    } else if (status === 'going') {
      going += 1;
    }
  }

  return {
    attended,
    events: input.ownedEventCount,
    going
  };
};
