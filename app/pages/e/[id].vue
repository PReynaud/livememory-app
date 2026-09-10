<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { definePageMeta, navigateTo, useRoute, useToast } from '#imports';
import { storeToRefs } from 'pinia';
import { useEventsStore, type ConcertRecord } from '@/stores/events';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';
import { useEditEventSheetStore } from '@/stores/edit-event-sheet';
import { COPY_LINK_FAILED } from '@/utils/copy-link';
import { LINK_COPIED, shareEventLink } from '@/utils/share-event';
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
const shareBusy = ref(false);
const confirmLeave = ref(false);
const leaving = ref(false);
const hasLeft = ref(false);
const leaveError = ref('');

const eventId = computed(() => {
  const id = route.params.id;
  return typeof id === 'string' ? id : '';
});

const notFound = computed(() => {
  return hasResolved.value && !currentEvent.value && !error.value && !hasLeft.value && !leaving.value;
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
const eventKindLabel = computed(() => {
  return currentEvent.value?.kind === 'festival' ? 'Festival' : 'Night';
});
const eventLead = computed(() => {
  if (!currentEvent.value) {
    return '';
  }

  return [formatEventDateLabel(currentEvent.value), currentEvent.value.place].filter(Boolean).join(' · ');
});
const showNightGoingChip = computed(() => {
  return currentEvent.value?.kind === 'single_night' && hasConcerts.value;
});
const nightIsPast = computed(() => {
  return hasConcerts.value && currentConcerts.value.every(row => eventsStore.concertIsPast(row));
});
const concertCountLabel = computed(() => {
  const count = currentConcerts.value.length;
  return count === 1 ? '1 concert' : `${count} concerts`;
});

const stageName = (concert: ConcertRecord) => {
  if (concert.stage_name) {
    return concert.stage_name;
  }

  return eventsStore.currentStages.find(stage => stage.id === concert.stage_id)?.name ?? '';
};

const concertMeta = (concert: ConcertRecord) => {
  return [concert.time ? formatConcertClock(concert.time) : '', stageName(concert)].filter(Boolean).join(' · ');
};

const loadEvent = async (id: string) => {
  hasResolved.value = false;
  confirmLeave.value = false;
  leaveError.value = '';
  hasLeft.value = false;
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

const shareThisEvent = async () => {
  if (!currentEvent.value || shareBusy.value) {
    return;
  }

  shareBusy.value = true;
  try {
    const result = await shareEventLink({
      title: currentEvent.value.name,
      text: `${currentEvent.value.name} — ${eventLead.value}`,
      url: window.location.href
    });
    if (result.error) {
      toast.add({ title: COPY_LINK_FAILED });
      return;
    }

    if (result.method === 'clipboard') {
      toast.add({ title: LINK_COPIED });
    }
  } finally {
    shareBusy.value = false;
  }
};

const requestLeave = () => {
  confirmLeave.value = true;
  leaveError.value = '';
};

const cancelLeave = () => {
  confirmLeave.value = false;
};

const leaveThisEvent = async () => {
  if (!currentEvent.value || leaving.value) {
    return;
  }

  leaving.value = true;
  leaveError.value = '';

  try {
    const result = await eventsStore.leaveJoinedEvent(currentEvent.value.id);
    if (result.error) {
      leaveError.value = result.error;
      return;
    }

    hasLeft.value = true;
    await navigateTo('/concerts');
  } finally {
    leaving.value = false;
  }
};
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-5">
    <template v-if="currentEvent">
      <header class="space-y-0">
        <p class="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          {{ eventKindLabel }}
        </p>
        <div class="flex items-start justify-between gap-3">
          <h1 class="min-w-0 flex-1 text-[34px] font-bold tracking-tight leading-[1.1]">
            {{ currentEvent.name }}
          </h1>
          <div class="lm-header-actions">
            <button
              v-if="isOwner"
              type="button"
              class="lm-header-icon"
              aria-label="Edit event"
              title="Edit event"
              @click="openEditEvent"
            >
              <UIcon
                name="i-lucide-pencil"
                class="size-5"
              />
            </button>
            <button
              type="button"
              class="lm-header-icon"
              aria-label="Share event"
              title="Share event"
              :disabled="shareBusy"
              :aria-busy="shareBusy || undefined"
              @click="void shareThisEvent()"
            >
              <UIcon
                name="i-lucide-share"
                class="lm-header-icon-spin size-5"
              />
            </button>
          </div>
        </div>
        <p class="mt-2 max-w-[40ch] text-[15px] leading-[1.45] text-muted">
          {{ eventLead }}
        </p>
      </header>

      <section
        class="space-y-3"
        aria-labelledby="event-bill-heading"
      >
        <div class="flex items-center justify-between gap-3 px-0.5">
          <h2
            id="event-bill-heading"
            class="text-xs font-semibold uppercase tracking-[0.08em] text-muted"
          >
            Bill
          </h2>
          <div class="flex shrink-0 items-center gap-2.5">
            <AppAttendanceChip
              v-if="showNightGoingChip"
              :status="eventsStore.eventGoingStatus(currentEvent.id)"
              :is-past="nightIsPast"
              :disabled="eventsStore.isEventGoingBusy(currentEvent.id)"
              @click="void eventsStore.cycleEventGoing(currentEvent.id)"
            />
            <span
              class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-semibold tabular-nums"
              :aria-label="concertCountLabel"
            >
              {{ currentConcerts.length }}
            </span>
          </div>
        </div>

        <div class="lm-card p-3.5 space-y-0">
          <template v-if="billLoadFailed">
            <AppLoadError @retry="retryLoad" />
          </template>
          <p
            v-else-if="!hasConcerts"
            class="text-[15px] text-muted"
          >
            No concerts on this bill.
          </p>
          <template v-else>
            <div
              v-for="(group, index) in billGroups"
              :key="group.date"
              :class="index > 0 ? 'mt-3 border-t border-white/8 pt-3' : ''"
            >
              <p
                v-if="showDayHeaders"
                class="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
              >
                {{ formatConcertDayLabel(group.date) }}
              </p>
              <div class="space-y-2">
                <div
                  v-for="concert in group.concerts"
                  :key="concert.id"
                  class="lm-concert-row"
                >
                  <button
                    v-if="isOwner"
                    type="button"
                    class="concert-main min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-inherit"
                    :aria-label="`Edit ${concert.artist}`"
                    @click="openEditSheet(concert)"
                  >
                    <p class="text-base font-semibold leading-snug">
                      {{ concert.artist }}
                    </p>
                    <p
                      v-if="concertMeta(concert)"
                      class="mt-0.5 text-[13px] leading-snug text-muted"
                    >
                      {{ concertMeta(concert) }}
                    </p>
                  </button>
                  <div
                    v-else
                    class="min-w-0 flex-1"
                  >
                    <p class="text-base font-semibold leading-snug">
                      {{ concert.artist }}
                    </p>
                    <p
                      v-if="concertMeta(concert)"
                      class="mt-0.5 text-[13px] leading-snug text-muted"
                    >
                      {{ concertMeta(concert) }}
                    </p>
                  </div>
                  <AppAttendanceChip
                    v-if="currentEvent.kind === 'festival'"
                    :status="eventsStore.attendanceStatus(concert.id)"
                    :is-past="eventsStore.concertIsPast(concert)"
                    :disabled="eventsStore.isAttendanceBusy(concert.id)"
                    @click="void eventsStore.cycleAttendance(concert)"
                  />
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>

      <UButton
        v-if="isOwner"
        :label="billCtaLabel"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        @click="openAddSheet"
      />
      <div
        v-if="!isOwner"
        class="member-zone mt-1 border-t border-white/8 pt-4"
      >
        <UButton
          v-if="!confirmLeave"
          label="Leave Event"
          color="neutral"
          variant="link"
          class="px-0 text-[13px] font-medium text-muted"
          :disabled="leaving"
          @click="requestLeave"
        />
        <div
          v-else
          class="space-y-3"
        >
          <p class="text-[15px] leading-[1.45] text-muted">
            Leave this Event? It will leave your list. The bill stays for the owner.
          </p>
          <div class="flex items-center gap-4">
            <UButton
              :label="leaving ? 'Leaving...' : 'Leave'"
              color="neutral"
              variant="outline"
              class="h-11 rounded-full"
              :loading="leaving"
              :disabled="leaving"
              :aria-busy="leaving || undefined"
              @click="void leaveThisEvent()"
            />
            <UButton
              label="Cancel"
              color="neutral"
              variant="link"
              class="px-0 font-semibold text-white"
              :disabled="leaving"
              @click="cancelLeave"
            />
          </div>
        </div>
      </div>
      <UAlert
        v-if="leaveError"
        color="error"
        variant="subtle"
        :title="leaveError"
        role="alert"
      />
    </template>

    <template v-else-if="!hasResolved">
      <AppListSkeleton variant="groups" />
    </template>

    <template v-else-if="loadFailed">
      <AppLoadError @retry="retryLoad" />
    </template>

    <template v-else-if="notFound">
      <p class="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
        Event
      </p>
      <h1 class="text-[34px] font-bold tracking-tight leading-tight text-muted">
        Event not found.
      </h1>
      <p class="mt-2 max-w-[40ch] text-[15px] leading-[1.45] text-muted">
        This Event is missing, or you cannot see it.
      </p>
    </template>
  </UContainer>
</template>
