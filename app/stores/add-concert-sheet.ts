import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  closedAddConcertSheetState,
  openAddConcertSheetState,
  type OpenAddConcertSheetOptions
} from '@/utils/add-concert-sheet-state';

export const useAddConcertSheetStore = defineStore('addConcertSheet', () => {
  const open = ref(false);
  const eventId = ref<string | null>(null);
  const lockEvent = ref(false);
  const concertId = ref<string | null>(null);

  const snapshot = () => ({
    open: open.value,
    eventId: eventId.value,
    lockEvent: lockEvent.value,
    concertId: concertId.value
  });

  const apply = (next: ReturnType<typeof snapshot>) => {
    open.value = next.open;
    eventId.value = next.eventId;
    lockEvent.value = next.lockEvent;
    concertId.value = next.concertId;
  };

  const openSheet = (options?: OpenAddConcertSheetOptions) => {
    apply(openAddConcertSheetState(snapshot(), options));
  };

  const closeSheet = () => {
    apply(closedAddConcertSheetState());
  };

  return {
    open,
    eventId,
    lockEvent,
    concertId,
    openSheet,
    closeSheet
  };
});
