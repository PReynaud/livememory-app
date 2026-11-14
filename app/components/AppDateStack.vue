<script setup lang="ts">
import { computed } from 'vue';
import { formatDateStack } from '@/utils/event-dates';

const props = defineProps<{
  date: string;
  endDate?: string;
  size?: 'sm' | 'lg';
}>();

const parts = computed(() => formatDateStack(props.date, props.endDate));
</script>

<template>
  <div
    class="lm-date-stack"
    :data-size="size ?? 'sm'"
    :data-range="parts.range ? 'true' : undefined"
    aria-hidden="true"
  >
    <span
      v-if="parts.weekday"
      class="lm-date-stack-weekday"
    >{{ parts.weekday }}</span>
    <span class="lm-date-stack-day">{{ parts.day }}</span>
    <span class="lm-date-stack-month">{{ parts.month }}</span>
    <span
      v-if="parts.range && parts.year"
      class="lm-date-stack-year"
    >{{ parts.year }}</span>
  </div>
</template>
