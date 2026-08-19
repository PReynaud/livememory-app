<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from '#imports';
import { storeToRefs } from 'pinia';
import { useEventsStore } from '@/stores/events';
import { surfaceNameForRoute } from '@/utils/surface-name';

const route = useRoute();
const { currentEvent } = storeToRefs(useEventsStore());

const announcement = computed(() => {
  return surfaceNameForRoute(route.path, currentEvent.value?.name ?? null);
});
</script>

<template>
  <div
    data-testid="route-announcer"
    class="sr-only"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {{ announcement }}
  </div>
</template>
