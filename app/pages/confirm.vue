<script setup lang="ts">
import { watch } from 'vue';
import { navigateTo, useRoute, useSupabaseUser } from '#imports';
import { getSafeInternalPath } from '@/utils/safe-redirect';

const user = useSupabaseUser();
const route = useRoute();

const getRedirectPath = (): string => getSafeInternalPath(route.query.redirect);

watch(user, (value) => {
  if (value) {
    navigateTo(getRedirectPath());
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
