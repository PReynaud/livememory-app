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
}>();

const eventsStore = useEventsStore();
const compact = computed(() => isCompactBill(props.concerts));
const concert = computed(() => props.concerts[0] ?? null);
const titleClass = computed(() => {
  return props.featured
    ? 'text-2xl font-bold tracking-tight leading-[1.15]'
    : 'text-base font-semibold';
});
const groups = computed(() => groupConcertsByDate(props.concerts));
const showDayHeaders = computed(() => shouldShowDayHeaders(props.event, props.concerts));
</script>

<template>
  <section
    class="rounded-2xl bg-[#1A1A1A] p-4"
    :class="compact ? '' : 'space-y-2'"
    :data-event-card="compact ? 'compact' : 'group'"
    :data-featured="featured ? 'true' : 'false'"
  >
    <div
      v-if="compact && concert"
      class="flex items-start justify-between gap-3"
    >
      <NuxtLink
        :to="`/e/${event.id}`"
        class="min-w-0 flex-1 space-y-1"
      >
        <p :class="titleClass">
          {{ concert.artist }}
        </p>
        <p class="text-[13px] text-muted">
          {{ formatConcertMetaLine(concert) }}
        </p>
        <p
          v-if="eventNameDiffersFromArtist(event.name, concert.artist)"
          class="text-[13px] text-muted"
        >
          {{ event.name }}
        </p>
      </NuxtLink>
      <AppAttendanceChip
        :status="eventsStore.attendanceStatus(concert.id)"
        :is-past="eventsStore.concertIsPast(concert)"
        :disabled="eventsStore.isAttendanceBusy(concert.id)"
        @click="void eventsStore.cycleAttendance(concert)"
      />
    </div>
    <template v-else>
      <NuxtLink
        :to="`/e/${event.id}`"
        class="block space-y-1"
      >
        <p :class="titleClass">
          {{ event.name }}
        </p>
        <p class="text-[13px] text-muted">
          {{ formatEventDateLabel(event) }}
        </p>
        <p class="text-[13px] text-muted">
          {{ event.place }}
        </p>
      </NuxtLink>
      <template v-if="concerts.length">
        <div
          v-for="(group, index) in groups"
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
            v-for="row in group.concerts"
            :key="row.id"
            class="flex items-start justify-between gap-3 py-1.5"
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
