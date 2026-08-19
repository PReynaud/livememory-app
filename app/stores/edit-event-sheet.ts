import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useEditEventSheetStore = defineStore('editEventSheet', () => {
  const open = ref(false);
  const eventId = ref<string | null>(null);

  const openSheet = (id: string) => {
    eventId.value = id;
    open.value = true;
  };

  const closeSheet = () => {
    open.value = false;
    eventId.value = null;
  };

  return {
    open,
    eventId,
    openSheet,
    closeSheet
  };
});
