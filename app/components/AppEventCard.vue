<script setup lang="ts">
import { computed } from 'vue';
import { useEventsStore, type ConcertRecord, type EventRecord } from '@/stores/events';
import { formatEventDateLabel } from '@/utils/event-dates';
import {
  earliestConcertClock,
  eventNameDiffersFromArtist,
  formatConcertClock,
  formatConcertDayLabel,
  formatConcertMetaLine,
  formatVenueLine,
  groupConcertsByDate,
  isCompactBill,
  shouldShowDayHeaders
} from '@/utils/concert-groups';

const props = defineProps<{
  event: EventRecord;
  concerts: ConcertRecord[];
  featured?: boolean;
  readonly?: boolean;
  hideAttendance?: boolean;
  variant?: 'default' | 'hero' | 'memory' | 'row';
}>();

const eventsStore = useEventsStore();
const compact = computed(() => isCompactBill(props.concerts));
const concert = computed(() => props.concerts[0] ?? null);
const showAttendance = computed(() => !props.readonly && !props.hideAttendance);
const isNight = computed(() => props.event.kind === 'single_night');
const stageNameFor = (row: ConcertRecord) => {
  if (row.stage_name) {
    return row.stage_name;
  }

  if (!row.stage_id) {
    return '';
  }

  return eventsStore.stagesForEvent(props.event.id).find(stage => stage.id === row.stage_id)?.name ?? '';
};
const concertStageName = computed(() => (concert.value ? stageNameFor(concert.value) : ''));
const sharedStageName = computed(() => {
  const names = new Set(props.concerts.map(stageNameFor));
  return names.size === 1 ? [...names][0] ?? '' : '';
});
const isHero = computed(() => props.variant === 'hero');
const stackDate = computed(() => {
  if (!props.featured && (!props.variant || props.variant === 'default')) {
    return '';
  }

  return compact.value && concert.value ? concert.value.date : props.event.start_date;
});
const stackClock = computed(() => {
  return props.featured && isNight.value ? earliestConcertClock(props.concerts) : '';
});
const showPlaceIcon = computed(() => isHero.value || props.featured);
const compactMeta = computed(() => {
  if (!concert.value) {
    return '';
  }

  return props.featured
    ? formatVenueLine(concertStageName.value, concert.value.place)
    : formatConcertMetaLine(concert.value, concertStageName.value);
});
const groupMeta = computed(() => {
  return props.featured
    ? formatVenueLine(sharedStageName.value, props.event.place)
    : [formatEventDateLabel(props.event), props.event.place].filter(Boolean).join(' · ');
});
const titleClass = computed(() => {
  if (isHero.value) {
    return 'text-[28px] font-bold tracking-tight leading-[1.1] [overflow-wrap:anywhere]';
  }

  return props.featured
    ? 'text-2xl font-bold tracking-tight leading-[1.15] [overflow-wrap:anywhere]'
    : 'text-base font-semibold [overflow-wrap:anywhere]';
});
const metaClass = computed(() => {
  return showPlaceIcon.value
    ? 'flex items-start gap-1 text-[13px] text-muted'
    : 'text-[13px] text-muted';
});
const groups = computed(() => groupConcertsByDate(props.concerts));
const showDayHeaders = computed(() => {
  if (props.featured && isNight.value) {
    return false;
  }

  return shouldShowDayHeaders(props.event, props.concerts);
});
const showRowClock = computed(() => !(props.featured && isNight.value));
const eventPath = computed(() => `/e/${props.event.id}`);
</script>

<template>
  <section
    class="lm-card lm-card-interactive"
    :class="isHero ? 'lm-hero p-5' : 'p-4'"
    :data-event-card="compact ? 'compact' : 'group'"
    :data-featured="featured ? 'true' : 'false'"
    :data-variant="variant ?? 'default'"
  >
    <div
      v-if="isHero"
      class="lm-hero-atmosphere"
      aria-hidden="true"
    />
    <div :class="stackDate ? 'flex items-start gap-3' : ''">
      <div
        v-if="stackDate"
        class="flex shrink-0 flex-col items-center gap-1.5"
      >
        <AppDateStack
          :date="stackDate"
          :size="isHero ? 'lg' : 'sm'"
        />
        <span
          v-if="stackClock"
          class="text-[13px] font-semibold tabular-nums text-muted"
          data-testid="event-card-time"
        >
          {{ stackClock }}
        </span>
      </div>
      <div
        class="min-w-0 flex-1"
        :class="compact ? '' : 'space-y-3'"
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
            <p
              v-if="compactMeta"
              :class="metaClass"
              data-testid="event-card-meta"
            >
              <UIcon
                v-if="showPlaceIcon"
                name="i-lucide-map-pin"
                class="mt-0.5 size-3.5 shrink-0"
                aria-label="Venue"
              />
              <span>{{ compactMeta }}</span>
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
            <p
              v-if="compactMeta"
              :class="metaClass"
              data-testid="event-card-meta"
            >
              <UIcon
                v-if="showPlaceIcon"
                name="i-lucide-map-pin"
                class="mt-0.5 size-3.5 shrink-0"
                aria-label="Venue"
              />
              <span>{{ compactMeta }}</span>
            </p>
            <p
              v-if="eventNameDiffersFromArtist(event.name, concert.artist)"
              class="text-[13px] text-muted"
            >
              {{ event.name }}
            </p>
          </NuxtLink>
          <AppAttendanceChip
            v-if="showAttendance"
            :status="eventsStore.attendanceStatus(concert.id)"
            :is-past="eventsStore.concertIsPast(concert)"
            :disabled="eventsStore.isAttendanceBusy(concert.id)"
            @click="void eventsStore.cycleAttendance(concert)"
          />
        </div>
        <template v-else>
          <div class="flex items-start justify-between gap-3 border-b border-[var(--hairline)] pb-3 mb-3">
            <a
              v-if="readonly"
              :href="eventPath"
              class="min-w-0 flex-1 space-y-1"
            >
              <p :class="titleClass">
                {{ event.name }}
              </p>
              <p
                v-if="groupMeta"
                :class="metaClass"
                data-testid="event-card-meta"
              >
                <UIcon
                  v-if="showPlaceIcon"
                  name="i-lucide-map-pin"
                  class="mt-0.5 size-3.5 shrink-0"
                  aria-label="Venue"
                />
                <span>{{ groupMeta }}</span>
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
              <p
                v-if="groupMeta"
                :class="metaClass"
                data-testid="event-card-meta"
              >
                <UIcon
                  v-if="showPlaceIcon"
                  name="i-lucide-map-pin"
                  class="mt-0.5 size-3.5 shrink-0"
                  aria-label="Venue"
                />
                <span>{{ groupMeta }}</span>
              </p>
            </NuxtLink>
            <AppAttendanceChip
              v-if="showAttendance && event.kind === 'single_night' && concerts.length > 0"
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
              :class="[index > 0 ? 'mt-2.5 border-t border-[var(--hairline)] pt-2.5' : '', 'space-y-1.5']"
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
                  <p class="text-base font-semibold [overflow-wrap:anywhere]">
                    {{ row.artist }}
                  </p>
                  <p
                    v-if="showRowClock && row.time"
                    class="text-[13px] text-muted"
                  >
                    {{ formatConcertClock(row.time) }}
                  </p>
                </div>
                <AppAttendanceChip
                  v-if="showAttendance && event.kind === 'festival'"
                  :status="eventsStore.attendanceStatus(row.id)"
                  :is-past="eventsStore.concertIsPast(row)"
                  :disabled="eventsStore.isAttendanceBusy(row.id)"
                  @click="void eventsStore.cycleAttendance(row)"
                />
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </section>
</template>
