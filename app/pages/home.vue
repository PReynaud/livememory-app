<script setup lang="ts">
import { computed } from 'vue';
import { definePageMeta } from '#imports';
import { storeToRefs } from 'pinia';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';
import { useEventsStore } from '@/stores/events';

definePageMeta({
  middleware: 'auth'
});

const addSheet = useAddConcertSheetStore();
const eventsStore = useEventsStore();
const { featuredEvents, lastNightEvent, homeStats, error, loading } = storeToRefs(eventsStore);
const hasFeatured = computed(() => featuredEvents.value.length > 0);
const showSkeleton = computed(() => loading.value && !error.value);
const homeEyebrow = computed(() => {
  if (showSkeleton.value || error.value || hasFeatured.value) {
    return '';
  }

  return 'Your journal';
});

const retryLoad = () => {
  void eventsStore.fetchEvents();
};

if (import.meta.server) {
  await eventsStore.fetchEvents({ silent: eventsStore.events.length > 0 });
} else {
  void eventsStore.fetchEvents({ silent: eventsStore.events.length > 0 });
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-4">
    <header class="mb-2">
      <p
        v-if="homeEyebrow"
        class="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"
      >
        {{ homeEyebrow }}
      </p>
      <h1 class="text-[34px] font-bold tracking-tight leading-tight">
        Home
      </h1>
    </header>

    <AppListSkeleton
      v-if="showSkeleton"
      variant="home"
    />

    <AppLoadError
      v-else-if="error"
      testid="home-load-error"
      @retry="retryLoad"
    />

    <template v-else>
      <section
        v-if="!hasFeatured"
        data-testid="home-featured-empty"
        class="lm-card px-5 py-7 text-center space-y-3"
      >
        <div
          class="mx-auto flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--well)] text-muted"
          aria-hidden="true"
        >
          <UIcon
            name="i-lucide-music"
            class="size-5"
          />
        </div>
        <p class="text-[22px] font-bold tracking-tight leading-[1.15]">
          Nothing upcoming.
        </p>
        <p class="mx-auto max-w-64 text-muted">
          Add a night or a concert.
        </p>
        <UButton
          label="Add concert"
          color="primary"
          variant="outline"
          class="h-11 rounded-full ring-2"
          @click="addSheet.openSheet()"
        />
      </section>

      <section
        v-else
        data-testid="home-featured"
        class="space-y-3"
      >
        <h2 class="px-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          Coming up
        </h2>
        <div class="space-y-3">
          <AppEventCard
            v-for="(event, index) in featuredEvents"
            :key="event.id"
            :event="event"
            :concerts="eventsStore.concertsForEvent(event.id)"
            :variant="index === 0 ? 'hero' : 'default'"
            featured
            hide-attendance
          />
        </div>
      </section>

      <section
        v-if="lastNightEvent"
        data-testid="home-last-night"
        aria-labelledby="home-last-night-heading"
        class="space-y-3"
      >
        <h2
          id="home-last-night-heading"
          class="px-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted"
        >
          Last night
        </h2>
        <AppEventCard
          :event="lastNightEvent"
          :concerts="eventsStore.concertsForEvent(lastNightEvent.id)"
          variant="memory"
          hide-attendance
        />
      </section>

      <section
        data-testid="home-stats"
        aria-labelledby="home-souvenirs-heading"
        class="lm-card p-4"
      >
        <h2
          id="home-souvenirs-heading"
          class="mb-3.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted"
        >
          Your souvenirs
        </h2>
        <div class="flex">
          <div
            class="min-w-0 flex-1 px-3 text-center first:pl-0"
            data-stat="attended"
          >
            <p class="text-[28px] font-bold tracking-tight leading-tight tabular-nums">
              {{ homeStats.attended }}
            </p>
            <p class="mt-1.5 text-xs tracking-wide text-muted">
              Attended
            </p>
          </div>
          <div
            class="min-w-0 flex-1 border-l border-[var(--border)] px-3 text-center"
            data-stat="events"
          >
            <p class="text-[28px] font-bold tracking-tight leading-tight tabular-nums">
              {{ homeStats.events }}
            </p>
            <p class="mt-1.5 text-xs tracking-wide text-muted">
              Events
            </p>
          </div>
          <div
            class="min-w-0 flex-1 border-l border-[var(--border)] px-3 text-center last:pr-0"
            data-stat="going"
          >
            <p class="text-[28px] font-bold tracking-tight leading-tight tabular-nums">
              {{ homeStats.going }}
            </p>
            <p class="mt-1.5 text-xs tracking-wide text-muted">
              Upcoming
            </p>
          </div>
        </div>
      </section>
    </template>
  </UContainer>
</template>
