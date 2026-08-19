<script setup lang="ts">
defineProps<{
  variant: 'home' | 'groups';
}>();
</script>

<template>
  <div
    data-testid="list-skeleton"
    class="space-y-2.5"
    aria-busy="true"
    aria-label="Loading"
  >
    <template v-if="variant === 'home'">
      <USkeleton class="h-28 w-full rounded-2xl" />
      <div class="rounded-2xl bg-[#1A1A1A] p-4 flex gap-4">
        <USkeleton class="h-12 flex-1" />
        <USkeleton class="h-12 flex-1" />
        <USkeleton class="h-12 flex-1" />
      </div>
    </template>
    <template v-else>
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="h-24 w-full rounded-2xl"
      />
    </template>
  </div>
</template>
