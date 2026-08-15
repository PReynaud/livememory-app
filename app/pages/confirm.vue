<script setup lang="ts">
import { watch } from 'vue';
import { navigateTo, useSupabaseUser } from '#imports';

const user = useSupabaseUser();

watch(user, (value) => {
  if (value) {
    navigateTo('/home');
  }
}, { immediate: true });
</script>

<template>
  <UContainer class="py-16 max-w-md text-center space-y-4">
    <UIcon
      name="i-lucide-loader-circle"
      class="size-8 mx-auto animate-spin text-primary"
    />
    <p class="text-muted">
      Confirming your session…
    </p>
  </UContainer>
</template>
