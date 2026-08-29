import { computed, ref } from 'vue';
import {
  cloneConcertListFilters,
  concertListFilterCount,
  emptyConcertListFilters,
  type ConcertListFilterState,
  type ListTab
} from '@/utils/concert-list-filters';

export const useConcertListFilters = () => {
  const applied = ref<Record<ListTab, ConcertListFilterState>>({
    upcoming: emptyConcertListFilters(),
    past: emptyConcertListFilters()
  });
  const draft = ref<ConcertListFilterState>(emptyConcertListFilters());
  const sheetOpen = ref(false);
  const sheetTab = ref<ListTab>('upcoming');

  const filtersFor = (tab: ListTab) => applied.value[tab];

  const activeCount = (tab: ListTab) => concertListFilterCount(applied.value[tab]);

  const openSheet = (tab: ListTab) => {
    sheetTab.value = tab;
    draft.value = cloneConcertListFilters(applied.value[tab]);
    sheetOpen.value = true;
  };

  const closeSheet = () => {
    sheetOpen.value = false;
  };

  const resetDraft = () => {
    draft.value = emptyConcertListFilters();
  };

  const applyDraft = () => {
    applied.value = {
      ...applied.value,
      [sheetTab.value]: cloneConcertListFilters(draft.value)
    };
    sheetOpen.value = false;
    return concertListFilterCount(applied.value[sheetTab.value]);
  };

  const removeCriterion = (tab: ListTab, id: string) => {
    const current = applied.value[tab];
    if (id === 'artist') {
      applied.value = {
        ...applied.value,
        [tab]: { ...current, artistQuery: '' }
      };
      return;
    }

    applied.value = {
      ...applied.value,
      [tab]: {
        ...current,
        ids: current.ids.filter(item => item !== id)
      }
    };
  };

  const clearAll = (tab: ListTab) => {
    applied.value = {
      ...applied.value,
      [tab]: emptyConcertListFilters()
    };
  };

  const draftCount = computed(() => concertListFilterCount(draft.value));

  return {
    applied,
    draft,
    sheetOpen,
    sheetTab,
    filtersFor,
    activeCount,
    openSheet,
    closeSheet,
    resetDraft,
    applyDraft,
    removeCriterion,
    clearAll,
    draftCount
  };
};
