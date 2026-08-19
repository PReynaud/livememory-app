<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { definePageMeta, useRoute } from '#imports';
import { storeToRefs } from 'pinia';
import { useEventsStore } from '@/stores/events';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';
import { formatEventDateLabel } from '@/utils/event-dates';
import {
  formatConcertClock,
  formatConcertDayLabel,
  groupConcertsByDate,
  shouldShowDayHeaders
} from '@/utils/concert-groups';

definePageMeta({
  middleware: 'auth'
});

const route = useRoute();
const eventsStore = useEventsStore();
const addSheet = useAddConcertSheetStore();
const { currentEvent, currentConcerts, error } = storeToRefs(eventsStore);
const hasResolved = ref(false);

const eventId = computed(() => {
  const id = route.params.id;
  return typeof id === 'string' ? id : '';
});

const notFound = computed(() => {
  return hasResolved.value && !currentEvent.value && !error.value;
});

const loadFailed = computed(() => {
  return hasResolved.value && !currentEvent.value && Boolean(error.value);
});

const billGroups = computed(() => groupConcertsByDate(currentConcerts.value));
const showDayHeaders = computed(() => {
  if (!currentEvent.value) {
    return false;
  }

  return shouldShowDayHeaders(currentEvent.value, currentConcerts.value);
});
const hasConcerts = computed(() => currentConcerts.value.length > 0);
const billLoadFailed = computed(() => {
  return Boolean(currentEvent.value && error.value);
});
const billCtaLabel = computed(() => {
  return currentEvent.value?.kind === 'festival' ? 'Add to this festival' : 'Add to this night';
});

const loadEvent = async (id: string) => {
  hasResolved.value = false;
  if (!id) {
    hasResolved.value = true;
    return;
  }

  const requested = id;
  await eventsStore.fetchEvent(id);
  if (eventId.value === requested) {
    hasResolved.value = true;
  }
};

watch(eventId, (id) => {
  void loadEvent(id);
}, { immediate: true });

const retryLoad = () => {
  void loadEvent(eventId.value);
};

const openAddSheet = () => {
  if (!currentEvent.value) {
    return;
  }

  addSheet.openSheet({
    eventId: currentEvent.value.id,
    lockEvent: true
  });
};
</script>

<template>
  <UContainer class="py-8 max-w-lg space-y-4">
    <template v-if="currentEvent">
      <h1 class="text-[34px] font-bold tracking-tight leading-tight">
        {{ currentEvent.name }}
      </h1>
      <p class="text-[13px] text-muted">
        {{ formatEventDateLabel(currentEvent) }}
      </p>
      <p class="text-[13px] text-muted">
        {{ currentEvent.place }}
      </p>
      <section class="rounded-2xl bg-[#1A1A1A] p-4 space-y-2">
        <template v-if="billLoadFailed">
          <p class="text-lg font-semibold">
            Couldn't load.
          </p>
          <UButton
            label="Retry"
            color="primary"
            variant="outline"
            class="h-11 rounded-full ring-2"
            @click="retryLoad"
          />
        </template>
        <p
          v-else-if="!hasConcerts"
          class="text-lg font-semibold"
        >
          No concerts on this bill.
        </p>
        <template v-else>
          <div
            v-for="(group, index) in billGroups"
            :key="group.date"
            :class="index > 0 ? 'border-t border-white/10 pt-2' : ''"
          >
            <p
              v-if="showDayHeaders"
              class="text-[13px] font-semibold text-muted"
            >
              {{ formatConcertDayLabel(group.date) }}
            </p>
            <div
              v-for="concert in group.concerts"
              :key="concert.id"
              class="flex items-start justify-between gap-3 py-1.5"
            >
              <div class="min-w-0">
                <p class="text-base font-semibold">
                  {{ concert.artist }}
                </p>
                <p
                  v-if="concert.time"
                  class="text-[13px] text-muted"
                >
                  {{ formatConcertClock(concert.time) }}
                </p>
              </div>
              <AppAttendanceChip
                :status="eventsStore.attendanceStatus(concert.id)"
                :is-past="eventsStore.concertIsPast(concert)"
                @click="void eventsStore.cycleAttendance(concert)"
              />
            </div>
          </div>
        </template>
      </section>
      <UButton
        :label="billCtaLabel"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        @click="openAddSheet"
      />
    </template>

    <template v-else-if="!hasResolved">
      <p class="text-sm text-muted">
        Loading event…
      </p>
    </template>

    <template v-else-if="loadFailed">
      <p class="text-lg font-semibold">
        Couldn't load.
      </p>
      <UButton
        label="Retry"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        @click="retryLoad"
      />
    </template>

    <template v-else-if="notFound">
      <h1 class="text-[34px] font-bold tracking-tight leading-tight">
        Event not found.
      </h1>
    </template>
  </UContainer>
</template>
