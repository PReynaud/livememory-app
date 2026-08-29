import { ref } from 'vue';
import type { ListTab } from '@/utils/concert-list-filters';

export const useEventListTabs = (initial: ListTab = 'upcoming') => {
  const tab = ref<ListTab>(initial);

  const setTab = (next: ListTab) => {
    tab.value = next;
  };

  return {
    tab,
    setTab
  };
};
