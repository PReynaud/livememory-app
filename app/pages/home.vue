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
const { featuredEvents, homeStats, error } = storeToRefs(eventsStore);
const hasFeatured = computed(() => featuredEvents.value.length > 0);

await eventsStore.fetchEvents();
</script>

<template>
  <UContainer class="py-8 max-w-lg space-y-4">
    <h1 class="text-[34px] font-bold tracking-tight leading-tight">
      Home
    </h1>

    <p
      v-if="error"
      class="text-sm text-muted"
    >
      {{ error }}
    </p>

    <section
      v-if="!hasFeatured"
      data-testid="home-featured-empty"
      class="rounded-2xl bg-[#1A1A1A] p-4 space-y-3"
    >
      <p class="text-2xl font-bold tracking-tight leading-[1.15]">
        Nothing upcoming.
      </p>
      <p class="text-muted">
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

    <div
      v-else
      data-testid="home-featured"
      class="space-y-2.5"
    >
      <AppEventCard
        v-for="event in featuredEvents"
        :key="event.id"
        :event="event"
        :concerts="eventsStore.concertsForEvent(event.id)"
        featured
      />
    </div>

    <section
      data-testid="home-stats"
      aria-label="Souvenir stats"
      class="rounded-2xl bg-[#1A1A1A] p-4 flex"
    >
      <div
        class="flex-1"
        data-stat="attended"
      >
        <p class="text-2xl font-bold tracking-tight leading-[1.15]">
          {{ homeStats.attended }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Attended
        </p>
      </div>
      <div
        class="flex-1"
        data-stat="events"
      >
        <p class="text-2xl font-bold tracking-tight leading-[1.15]">
          {{ homeStats.events }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Events
        </p>
      </div>
      <div
        class="flex-1"
        data-stat="going"
      >
        <p class="text-2xl font-bold tracking-tight leading-[1.15]">
          {{ homeStats.going }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Going
        </p>
      </div>
    </section>
  </UContainer>
</template>
