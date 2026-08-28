<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useToast } from '#imports';
import { useSharedListStore } from '@/stores/shared-list';
import { SHARED_LIST_EMPTY, SHARED_LIST_NOT_FOUND } from '#shared/domain/shared-list';
import { useConcertListFilters } from '@/composables/useConcertListFilters';
import { useEventListTabs } from '@/composables/useEventListTabs';
import { CONCERT_LIST_COPY } from '@/utils/concert-list-copy';
import {
  buildConcertFilterCatalog,
  concertFilterChips,
  filterEventsByConcertFilters,
  splitEventsForConcerts,
  type ListTab
} from '@/utils/concert-list-filters';

const route = useRoute();
const toast = useToast();
const sharedListStore = useSharedListStore();
const { profile, groups, error } = storeToRefs(sharedListStore);
const hasResolved = ref(false);
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

const username = computed(() => {
  const value = route.params.username;
  return typeof value === 'string' ? value : '';
});

const notFound = computed(() => {
  return hasResolved.value && !profile.value && !error.value;
});

const loadFailed = computed(() => {
  return hasResolved.value && !profile.value && Boolean(error.value);
});

const isEmpty = computed(() => {
  return Boolean(profile.value) && groups.value.length === 0;
});

const events = computed(() => groups.value.map(group => group.event));
const concertsByEventId = computed(() => {
  return Object.fromEntries(groups.value.map(group => [group.event.id, group.concerts]));
});
const buckets = computed(() => splitEventsForConcerts(events.value));
const sourceEvents = computed(() => {
  return tab.value === 'upcoming' ? buckets.value.upcoming : buckets.value.past;
});
const activeFilters = computed(() => filtersFor(tab.value));
const listedEvents = computed(() => filterEventsByConcertFilters(
  sourceEvents.value,
  eventId => concertsByEventId.value[eventId] ?? [],
  {},
  activeFilters.value
));
const filterCount = computed(() => activeCount(tab.value));
const catalog = computed(() => {
  return buildConcertFilterCatalog(sourceEvents.value, tab.value, { includeStatus: false });
});
const sheetCatalog = computed(() => {
  const bucket = sheetTab.value === 'upcoming' ? buckets.value.upcoming : buckets.value.past;
  return buildConcertFilterCatalog(bucket, sheetTab.value, { includeStatus: false });
});
const chips = computed(() => concertFilterChips(activeFilters.value, catalog.value));
const filterHint = computed(() => {
  return tab.value === 'past'
    ? CONCERT_LIST_COPY.filterHintPast
    : CONCERT_LIST_COPY.filterHintUpcomingPublic;
});
const isFilteredEmpty = computed(() => {
  return sourceEvents.value.length > 0 && listedEvents.value.length === 0;
});
const emptyCopy = computed(() => {
  if (isFilteredEmpty.value) {
    return CONCERT_LIST_COPY.emptyFiltered;
  }

  return tab.value === 'past'
    ? CONCERT_LIST_COPY.emptyPast
    : CONCERT_LIST_COPY.emptyUpcomingPublic;
});
const concertsForEvent = (eventId: string) => concertsByEventId.value[eventId] ?? [];

const loadProfile = async (handle: string) => {
  hasResolved.value = false;
  const pending = handle;
  await sharedListStore.fetchPublicProfile(pending);
  if (pending !== username.value) {
    return;
  }

  hasResolved.value = true;
};

const onTabChange = (next: ListTab) => {
  setTab(next);
};

const applyFilters = () => {
  const count = applyDraft();
  toast.add({ title: CONCERT_LIST_COPY.filtersApplied(count) });
};

watch(username, (handle) => {
  void loadProfile(handle);
}, { immediate: true });
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-4">
    <template v-if="profile">
      <div
        data-testid="route-announcer"
        class="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Shared list for {{ profile.username }}
      </div>
      <h1 class="text-[34px] font-bold tracking-tight leading-tight">
        {{ profile.username }}
      </h1>

      <p
        v-if="isEmpty"
        data-testid="shared-list-empty"
        class="text-muted"
      >
        {{ SHARED_LIST_EMPTY }}
      </p>

      <template v-else>
        <AppEventListControls
          :tab="tab"
          :upcoming-count="buckets.upcoming.length"
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
          data-testid="shared-list-groups"
          :aria-labelledby="tab === 'past' ? 'concert-tab-past' : 'concert-tab-upcoming'"
        >
          <p
            v-if="listedEvents.length === 0"
            class="text-muted"
            :data-testid="isFilteredEmpty ? 'shared-list-filter-empty' : 'shared-list-tab-empty'"
          >
            {{ emptyCopy }}
          </p>
          <div
            v-else
            class="space-y-2.5"
          >
            <AppEventCard
              v-for="event in listedEvents"
              :key="event.id"
              :event="event"
              :concerts="concertsForEvent(event.id)"
              readonly
            />
          </div>
        </div>
      </template>

      <AppFilterConcertSheet
        v-if="!isEmpty"
        v-model:open="sheetOpen"
        :tab="sheetTab"
        :draft="draft"
        :catalog="sheetCatalog"
        :draft-count="draftCount"
        @update:draft="draft = $event"
        @apply="applyFilters"
        @reset="resetDraft()"
      />
    </template>

    <template v-else-if="!hasResolved">
      <AppListSkeleton variant="groups" />
    </template>

    <template v-else-if="loadFailed">
      <AppLoadError
        testid="shared-list-load-error"
        @retry="void loadProfile(username)"
      />
    </template>

    <template v-else-if="notFound">
      <h1 class="text-[34px] font-bold tracking-tight leading-tight">
        {{ SHARED_LIST_NOT_FOUND }}
      </h1>
    </template>
  </UContainer>
</template>
