export type AddConcertSheetState = {
  open: boolean;
  eventId: string | null;
  lockEvent: boolean;
};

export type OpenAddConcertSheetOptions = {
  eventId?: string;
  lockEvent?: boolean;
};

export const openAddConcertSheetState = (
  current: AddConcertSheetState,
  options?: OpenAddConcertSheetOptions
): AddConcertSheetState => {
  if (options) {
    return {
      open: true,
      eventId: options.eventId ?? null,
      lockEvent: options.lockEvent ?? Boolean(options.eventId)
    };
  }

  if (current.open) {
    return {
      open: true,
      eventId: current.eventId,
      lockEvent: current.lockEvent
    };
  }

  return {
    open: true,
    eventId: null,
    lockEvent: false
  };
};

export const closedAddConcertSheetState = (): AddConcertSheetState => ({
  open: false,
  eventId: null,
  lockEvent: false
});
