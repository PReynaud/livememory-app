<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: 'going' | 'attended' | null;
  isPast: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  click: [];
}>();

const confirmed = computed(() => props.status === 'going' || props.status === 'attended');
const displayStatus = computed(() => {
  if (props.status) {
    return props.status;
  }

  return props.isPast ? 'attended' : 'going';
});
const label = computed(() => (displayStatus.value === 'attended' ? 'Attended' : 'Going'));
const accessibleName = computed(() => {
  return displayStatus.value === 'attended' ? 'Mark as attended' : 'Mark as going';
});
const chipClass = computed(() => {
  const base = 'inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold leading-none';

  if (!confirmed.value && displayStatus.value === 'going') {
    return `${base} border border-dashed border-[#FF4D8A] bg-transparent text-[#FF4D8A]`;
  }

  if (!confirmed.value) {
    return `${base} border border-dashed border-[#A3A3A3] bg-transparent text-[#A3A3A3]`;
  }

  if (displayStatus.value === 'going') {
    return `${base} border border-[#FF4D8A] bg-transparent text-[#FF4D8A] shadow-[0_0_8px_#FF4D8A] motion-reduce:shadow-none motion-reduce:outline motion-reduce:outline-1 motion-reduce:outline-[#FF4D8A]`;
  }

  return `${base} border border-[#A3A3A3] bg-[#A3A3A3] text-black`;
});
</script>

<template>
  <button
    type="button"
    :aria-label="accessibleName"
    :aria-pressed="confirmed"
    :class="chipClass"
    :disabled="disabled"
    @click="$emit('click')"
  >
    {{ label }}
  </button>
</template>
