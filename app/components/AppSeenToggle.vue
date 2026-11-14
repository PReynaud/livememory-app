<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  seen: boolean;
  artist: string;
  disabled?: boolean;
}>();

defineEmits<{
  click: [];
}>();

const accessibleName = computed(() => `Seen: ${props.artist}`);
const hint = computed(() => (props.seen ? 'Mark as not seen' : 'Mark as seen'));
const buttonClass = computed(() => {
  const base = 'inline-flex size-11 shrink-0 items-center justify-center rounded-full -my-2.5 -mr-2.5 transition-colors motion-reduce:transition-none disabled:opacity-50';
  const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-[var(--focus)]';

  return props.seen
    ? `${base} ${focusRing} text-[var(--fg)]`
    : `${base} ${focusRing} text-[var(--muted)]`;
});
</script>

<template>
  <button
    type="button"
    :aria-label="accessibleName"
    :aria-pressed="seen"
    :title="hint"
    :data-seen="seen ? 'true' : 'false'"
    :class="buttonClass"
    :disabled="disabled"
    data-testid="seen-toggle"
    @click.stop.prevent="$emit('click')"
  >
    <UIcon
      :name="seen ? 'i-lucide-eye' : 'i-lucide-eye-off'"
      class="size-[18px]"
      aria-hidden="true"
    />
  </button>
</template>
