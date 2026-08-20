<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { definePageMeta, useRoute, useToast } from '#imports';
import { storeToRefs } from 'pinia';
import { useEventsStore, type ConcertRecord } from '@/stores/events';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';
import { useEditEventSheetStore } from '@/stores/edit-event-sheet';
import { COPY_LINK_FAILED, copyTextToClipboard } from '@/utils/copy-link';
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
const toast = useToast();
const eventsStore = useEventsStore();
const addSheet = useAddConcertSheetStore();
const editEventSheet = useEditEventSheetStore();
const { currentEvent, currentConcerts, error, isOwner } = storeToRefs(eventsStore);
const hasResolved = ref(false);
const copyBusy = ref(false);

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
  return Boolean(currentEvent.value && error.value && !hasConcerts.value);
});
const billCtaLabel = computed(() => {
  return currentEvent.value?.kind === 'festival' ? 'Add to this festival' : 'Add to this night';
});
const showAttendThisNight = computed(() => {
  return currentEvent.value?.kind === 'single_night' && hasConcerts.value;
});

const stageName = (concert: ConcertRecord) => {
  return eventsStore.currentStages.find(stage => stage.id === concert.stage_id)?.name ?? '';
};

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

const openEditEvent = () => {
  if (!currentEvent.value) {
    return;
  }

  editEventSheet.openSheet(currentEvent.value.id);
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

const attendThisNight = async () => {
  if (!currentEvent.value) {
    return;
  }

  await eventsStore.attendThisNight(currentEvent.value.id);
};

const openEditSheet = (concert: ConcertRecord) => {
  if (!currentEvent.value || !isOwner.value) {
    return;
  }

  addSheet.openSheet({
    eventId: currentEvent.value.id,
    lockEvent: true,
    concertId: concert.id
  });
};

const copyEventLink = async () => {
  if (copyBusy.value) {
    return;
  }

  copyBusy.value = true;
  try {
    const result = await copyTextToClipboard(window.location.href);
    if (result.error) {
      toast.add({ title: COPY_LINK_FAILED });
    }
  } finally {
    copyBusy.value = false;
  }
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
      <UButton
        v-if="isOwner"
        label="Edit event"
        color="neutral"
        variant="link"
        class="px-0 font-semibold text-white"
        @click="openEditEvent"
      />
      <UButton
        v-if="isOwner"
        label="Copy link"
        color="neutral"
        variant="link"
        class="px-0 text-[13px] font-medium text-muted"
        :loading="copyBusy"
        @click="void copyEventLink()"
      />
      <section class="rounded-2xl bg-[#1A1A1A] p-4 space-y-2">
        <template v-if="billLoadFailed">
          <AppLoadError @retry="retryLoad" />
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
              <button
                v-if="isOwner"
                type="button"
                class="min-w-0 flex-1 text-left"
                :aria-label="`Edit ${concert.artist}`"
                @click="openEditSheet(concert)"
              >
                <p class="text-base font-semibold">
                  {{ concert.artist }}
                </p>
                <p
                  v-if="concert.time"
                  class="text-[13px] text-muted"
                >
                  {{ formatConcertClock(concert.time) }}
                </p>
                <p
                  v-if="stageName(concert)"
                  class="text-[13px] text-muted"
                >
                  {{ stageName(concert) }}
                </p>
              </button>
              <div
                v-else
                class="min-w-0 flex-1"
              >
                <p class="text-base font-semibold">
                  {{ concert.artist }}
                </p>
                <p
                  v-if="concert.time"
                  class="text-[13px] text-muted"
                >
                  {{ formatConcertClock(concert.time) }}
                </p>
                <p
                  v-if="stageName(concert)"
                  class="text-[13px] text-muted"
                >
                  {{ stageName(concert) }}
                </p>
              </div>
              <AppAttendanceChip
                v-if="isOwner"
                :status="eventsStore.attendanceStatus(concert.id)"
                :is-past="eventsStore.concertIsPast(concert)"
                :disabled="eventsStore.isAttendanceBusy(concert.id)"
                @click="void eventsStore.cycleAttendance(concert)"
              />
            </div>
          </div>
        </template>
      </section>
      <UButton
        v-if="isOwner && showAttendThisNight"
        label="Attend this night"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        :loading="eventsStore.isAttendThisNightBusy()"
        :disabled="eventsStore.isAttendThisNightBusy()"
        @click="void attendThisNight()"
      />
      <UButton
        v-if="isOwner"
        :label="billCtaLabel"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        @click="openAddSheet"
      />
    </template>

    <template v-else-if="!hasResolved">
      <AppListSkeleton variant="groups" />
    </template>

    <template v-else-if="loadFailed">
      <AppLoadError @retry="retryLoad" />
    </template>

    <template v-else-if="notFound">
      <h1 class="text-[34px] font-bold tracking-tight leading-tight">
        Event not found.
      </h1>
    </template>
  </UContainer>
</template>
