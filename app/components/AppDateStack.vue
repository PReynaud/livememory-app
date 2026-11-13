<script setup lang="ts">
import { computed } from 'vue';
import { formatDateStack } from '@/utils/event-dates';

const props = defineProps<{
  date: string;
  size?: 'sm' | 'lg';
}>();

const parts = computed(() => formatDateStack(props.date));
</script>

<template>
  <div
    class="lm-date-stack"
    :data-size="size ?? 'sm'"
    aria-hidden="true"
  >
    <span class="lm-date-stack-weekday">{{ parts.weekday }}</span>
    <span class="lm-date-stack-day">{{ parts.day }}</span>
    <span class="lm-date-stack-month">{{ parts.month }}</span>
  </div>
</template>
