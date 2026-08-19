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
const { currentEvent, error } = storeToRefs(eventsStore);
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
