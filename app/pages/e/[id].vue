<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { definePageMeta, useRoute } from '#imports';
import { storeToRefs } from 'pinia';
import { useEventsStore } from '@/stores/events';
import { formatEventDateLabel } from '@/utils/event-dates';

definePageMeta({
  middleware: 'auth'
});

const route = useRoute();
const eventsStore = useEventsStore();
const { currentEvent } = storeToRefs(eventsStore);
const hasResolved = ref(false);

const eventId = computed(() => {
  const id = route.params.id;
  return typeof id === 'string' ? id : '';
});

const notFound = computed(() => {
  return hasResolved.value && !currentEvent.value;
});

watch(eventId, async (id) => {
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
}, { immediate: true });
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
      <section class="rounded-2xl bg-[#1A1A1A] p-4">
        <p class="text-lg font-semibold">
          No concerts on this bill.
        </p>
      </section>
    </template>

    <template v-else-if="notFound">
      <h1 class="text-[34px] font-bold tracking-tight leading-tight">
        Event not found.
      </h1>
    </template>
  </UContainer>
</template>
