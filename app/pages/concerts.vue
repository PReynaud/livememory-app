<script setup lang="ts">
import { computed } from 'vue';
import { definePageMeta, useToast } from '#imports';
import { storeToRefs } from 'pinia';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';
import { useEventsStore } from '@/stores/events';
import { useConcertListFilters } from '@/composables/useConcertListFilters';
import { useEventListTabs } from '@/composables/useEventListTabs';
import { CONCERT_LIST_COPY } from '@/utils/concert-list-copy';
import {
  buildConcertFilterCatalog,
  concertFilterChips,
  EVENTS_LIST_WINDOW,
  filterEventsByConcertFilters,
  paginateConcertEvents,
  splitEventsForConcerts,
  type ListTab
} from '@/utils/concert-list-filters';

definePageMeta({
  middleware: 'auth'
});

const addSheet = useAddConcertSheetStore();
const eventsStore = useEventsStore();
const toast = useToast();
const { tab, setTab } = useEventListTabs();
const {
  draft,
  sheetOpen,
  sheetTab,
  filtersFor,
  activeCount,
  openSheet,
  resetDraft,
  applyDraft,
  removeCriterion,
  clearAll,
  draftCount
} = useConcertListFilters();
const {
  events,
  visibleEvents,
  loading,
  loadingMore,
  error
} = storeToRefs(eventsStore);

const hasEvents = computed(() => events.value.length > 0);
const showSkeleton = computed(() => loading.value && !error.value && !hasEvents.value);
const buckets = computed(() => splitEventsForConcerts(events.value));
const upcomingEvents = computed(() => buckets.value.upcoming);
const sourceEvents = computed(() => {
  return tab.value === 'upcoming' ? upcomingEvents.value : buckets.value.past;
});
const activeFilters = computed(() => filtersFor(tab.value));
const filteredEvents = computed(() => filterEventsByConcertFilters(
  sourceEvents.value,
  eventsStore.concertsForEvent,
  eventsStore.attendanceByConcertId,
  activeFilters.value
));
const pastPageSize = computed(() => {
  return Math.max(
    EVENTS_LIST_WINDOW,
    visibleEvents.value.length - upcomingEvents.value.length
  );
});
const listedEvents = computed(() => {
  if (tab.value !== 'past') {
    return filteredEvents.value;
  }

  return paginateConcertEvents(filteredEvents.value, pastPageSize.value);
});
const filterCount = computed(() => activeCount(tab.value));
const catalog = computed(() => {
  const bucket = tab.value === 'upcoming' ? upcomingEvents.value : buckets.value.past;
  return buildConcertFilterCatalog(bucket, tab.value);
});
const sheetCatalog = computed(() => {
  const bucket = sheetTab.value === 'upcoming' ? upcomingEvents.value : buckets.value.past;
  return buildConcertFilterCatalog(bucket, sheetTab.value);
});
const chips = computed(() => concertFilterChips(activeFilters.value, catalog.value));
const filterHint = computed(() => {
  return tab.value === 'past'
    ? CONCERT_LIST_COPY.filterHintPast
    : CONCERT_LIST_COPY.filterHintUpcoming;
});
const isFilteredEmpty = computed(() => {
  return sourceEvents.value.length > 0 && filteredEvents.value.length === 0;
});
const showLoadMore = computed(() => {
  return tab.value === 'past' && !error.value && listedEvents.value.length < filteredEvents.value.length;
});
const emptyCopy = computed(() => {
  if (isFilteredEmpty.value) {
    return CONCERT_LIST_COPY.emptyFiltered;
  }

  return tab.value === 'past'
    ? CONCERT_LIST_COPY.emptyPast
    : CONCERT_LIST_COPY.emptyUpcoming;
});
const showAddCta = computed(() => {
  return tab.value === 'upcoming' && !isFilteredEmpty.value && listedEvents.value.length === 0;
});

const retryLoad = () => {
  void eventsStore.fetchEvents();
};

const onTabChange = (next: ListTab) => {
  setTab(next);
};

const applyFilters = () => {
  const count = applyDraft();
  toast.add({ title: CONCERT_LIST_COPY.filtersApplied(count) });
};

if (import.meta.server) {
  await eventsStore.fetchEvents({ silent: eventsStore.events.length > 0 });
} else {
  void eventsStore.fetchEvents({ silent: eventsStore.events.length > 0 });
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-4">
    <h1 class="text-[34px] font-bold tracking-tight leading-tight">
      Concerts
    </h1>

    <AppListSkeleton
      v-if="showSkeleton"
      variant="groups"
    />

    <AppLoadError
      v-else-if="error"
      testid="concerts-load-error"
      @retry="retryLoad"
    />

    <template v-else>
      <AppEventListControls
        :tab="tab"
        :upcoming-count="upcomingEvents.length"
        :past-count="buckets.past.length"
        :filter-count="filterCount"
        :chips="chips"
        :hint="filterHint"
        @update:tab="onTabChange"
        @open-filter="openSheet(tab)"
        @remove-filter="removeCriterion(tab, $event)"
        @clear-filters="clearAll(tab)"
      />

      <div
        id="concert-list-panel"
        role="tabpanel"
        :aria-labelledby="tab === 'past' ? 'concert-tab-past' : 'concert-tab-upcoming'"
      >
        <section
          v-if="listedEvents.length === 0"
          class="lm-card px-5 py-7 text-center space-y-3"
          :data-testid="isFilteredEmpty ? 'concerts-filter-empty' : 'concerts-tab-empty'"
        >
          <p class="text-[22px] font-bold tracking-tight leading-[1.15]">
            {{ emptyCopy }}
          </p>
          <UButton
            v-if="showAddCta"
            :label="CONCERT_LIST_COPY.addConcert"
            color="primary"
            variant="outline"
            class="h-11 rounded-full ring-2"
            @click="addSheet.openSheet()"
          />
        </section>

        <div
          v-else
          class="space-y-2.5"
        >
          <AppEventCard
            v-for="event in listedEvents"
            :key="event.id"
            :event="event"
            :concerts="eventsStore.concertsForEvent(event.id)"
          />
          <p
            v-if="loadingMore"
            data-testid="loading-more"
            class="text-sm text-muted"
          >
            {{ CONCERT_LIST_COPY.loadingMore }}
          </p>
          <UButton
            v-else-if="showLoadMore"
            :label="CONCERT_LIST_COPY.loadMore"
            color="neutral"
            variant="ghost"
            class="w-full"
            @click="void eventsStore.loadMoreEvents()"
          />
        </div>
      </div>
    </template>

    <AppFilterConcertSheet
      v-model:open="sheetOpen"
      :tab="sheetTab"
      :draft="draft"
      :catalog="sheetCatalog"
      :draft-count="draftCount"
      @update:draft="draft = $event"
      @apply="applyFilters"
      @reset="resetDraft()"
    />
  </UContainer>
</template>
