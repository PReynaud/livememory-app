<script setup lang="ts">
defineProps<{
  testid?: string;
}>();

defineEmits<{
  retry: [];
}>();
</script>

<template>
  <div
    :data-testid="testid"
    class="space-y-3"
  >
    <p class="text-lg font-semibold">
      Couldn't load.
    </p>
    <UButton
      label="Retry"
      color="primary"
      variant="outline"
      class="h-11 rounded-full ring-2"
      @click="$emit('retry')"
    />
  </div>
</template>
