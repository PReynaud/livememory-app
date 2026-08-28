<script setup lang="ts">
import { computed } from 'vue';
import { useEventsStore, type ConcertRecord, type EventRecord } from '@/stores/events';
import { formatEventDateLabel } from '@/utils/event-dates';
import {
  eventNameDiffersFromArtist,
  formatConcertClock,
  formatConcertDayLabel,
  formatConcertMetaLine,
  groupConcertsByDate,
  isCompactBill,
  shouldShowDayHeaders
} from '@/utils/concert-groups';

const props = defineProps<{
  event: EventRecord;
  concerts: ConcertRecord[];
  featured?: boolean;
  readonly?: boolean;
}>();

const eventsStore = useEventsStore();
const compact = computed(() => isCompactBill(props.concerts));
const concert = computed(() => props.concerts[0] ?? null);
const concertStageName = computed(() => {
  if (concert.value?.stage_name) {
    return concert.value.stage_name;
  }

  if (!concert.value?.stage_id) {
    return '';
  }

  return eventsStore.stagesForEvent(props.event.id).find(stage => stage.id === concert.value?.stage_id)?.name ?? '';
});
const titleClass = computed(() => {
  return props.featured
    ? 'text-2xl font-bold tracking-tight leading-[1.15]'
    : 'text-base font-semibold';
});
const groups = computed(() => groupConcertsByDate(props.concerts));
const showDayHeaders = computed(() => shouldShowDayHeaders(props.event, props.concerts));
const eventPath = computed(() => `/e/${props.event.id}`);
</script>

<template>
  <section
    class="lm-card lm-card-interactive p-4"
    :class="compact ? '' : 'space-y-3'"
    :data-event-card="compact ? 'compact' : 'group'"
    :data-featured="featured ? 'true' : 'false'"
  >
    <div
      v-if="compact && concert"
      class="flex items-start justify-between gap-3"
    >
      <a
        v-if="readonly"
        :href="eventPath"
        class="min-w-0 flex-1 space-y-1"
      >
        <p :class="titleClass">
          {{ concert.artist }}
        </p>
        <p class="text-[13px] text-muted">
          {{ formatConcertMetaLine(concert, concertStageName) }}
        </p>
        <p
          v-if="eventNameDiffersFromArtist(event.name, concert.artist)"
          class="text-[13px] text-muted"
        >
          {{ event.name }}
        </p>
      </a>
      <NuxtLink
        v-else
        :to="eventPath"
        class="min-w-0 flex-1 space-y-1"
      >
        <p :class="titleClass">
          {{ concert.artist }}
        </p>
        <p class="text-[13px] text-muted">
          {{ formatConcertMetaLine(concert, concertStageName) }}
        </p>
        <p
          v-if="eventNameDiffersFromArtist(event.name, concert.artist)"
          class="text-[13px] text-muted"
        >
          {{ event.name }}
        </p>
      </NuxtLink>
      <AppAttendanceChip
        v-if="!readonly"
        :status="eventsStore.attendanceStatus(concert.id)"
        :is-past="eventsStore.concertIsPast(concert)"
        :disabled="eventsStore.isAttendanceBusy(concert.id)"
        @click="void eventsStore.cycleAttendance(concert)"
      />
    </div>
    <template v-else>
      <div class="flex items-start justify-between gap-3 border-b border-white/8 pb-3 mb-3">
        <a
          v-if="readonly"
          :href="eventPath"
          class="min-w-0 flex-1 space-y-1"
        >
          <p :class="titleClass">
            {{ event.name }}
          </p>
          <p class="text-[13px] text-muted">
            {{ [formatEventDateLabel(event), event.place].filter(Boolean).join(' · ') }}
          </p>
        </a>
        <NuxtLink
          v-else
          :to="eventPath"
          class="min-w-0 flex-1 space-y-1"
        >
          <p :class="titleClass">
            {{ event.name }}
          </p>
          <p class="text-[13px] text-muted">
            {{ [formatEventDateLabel(event), event.place].filter(Boolean).join(' · ') }}
          </p>
        </NuxtLink>
        <AppAttendanceChip
          v-if="!readonly && event.kind === 'single_night' && concerts.length > 0"
          :status="eventsStore.eventGoingStatus(event.id)"
          :is-past="concerts.length > 0 && concerts.every(row => eventsStore.concertIsPast(row))"
          :disabled="eventsStore.isEventGoingBusy(event.id)"
          @click="void eventsStore.cycleEventGoing(event.id)"
        />
      </div>
      <template v-if="concerts.length">
        <div
          v-for="(group, index) in groups"
          :key="group.date"
          :class="[index > 0 ? 'mt-2.5 border-t border-white/8 pt-2.5' : '', 'space-y-1.5']"
        >
          <p
            v-if="showDayHeaders"
            class="mb-1 px-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
          >
            {{ formatConcertDayLabel(group.date) }}
          </p>
          <div
            v-for="row in group.concerts"
            :key="row.id"
            class="lm-concert-row"
          >
            <div class="min-w-0">
              <p class="text-base font-semibold">
                {{ row.artist }}
              </p>
              <p
                v-if="row.time"
                class="text-[13px] text-muted"
              >
                {{ formatConcertClock(row.time) }}
              </p>
            </div>
            <AppAttendanceChip
              v-if="!readonly && event.kind === 'festival'"
              :status="eventsStore.attendanceStatus(row.id)"
              :is-past="eventsStore.concertIsPast(row)"
              :disabled="eventsStore.isAttendanceBusy(row.id)"
              @click="void eventsStore.cycleAttendance(row)"
            />
          </div>
        </div>
      </template>
    </template>
  </section>
</template>
