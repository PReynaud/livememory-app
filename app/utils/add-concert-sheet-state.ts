export type AddConcertSheetState = {
  open: boolean;
  eventId: string | null;
  lockEvent: boolean;
  concertId: string | null;
};

export type OpenAddConcertSheetOptions = {
  eventId?: string;
  lockEvent?: boolean;
  concertId?: string;
};

export const openAddConcertSheetState = (
  current: AddConcertSheetState,
  options?: OpenAddConcertSheetOptions
): AddConcertSheetState => {
  if (options) {
    return {
      open: true,
      eventId: options.eventId ?? null,
      lockEvent: options.lockEvent ?? Boolean(options.eventId),
      concertId: options.concertId ?? null
    };
  }

  if (current.open) {
    return {
      open: true,
      eventId: current.eventId,
      lockEvent: current.lockEvent,
      concertId: current.concertId
    };
  }

  return {
    open: true,
    eventId: null,
    lockEvent: false,
    concertId: null
  };
};

export const closedAddConcertSheetState = (): AddConcertSheetState => ({
  open: false,
  eventId: null,
  lockEvent: false,
  concertId: null
});
