<script setup lang="ts">
import { computed } from 'vue';
import { definePageMeta, useRuntimeConfig } from '#imports';
import { useAuthStore } from '@/stores/auth';

definePageMeta({
  middleware: 'auth'
});

const config = useRuntimeConfig();
const authStore = useAuthStore();
const email = computed(() => authStore.user?.email ?? 'you');
</script>

<template>
  <UContainer class="py-16 max-w-lg space-y-4">
    <h1 class="text-2xl font-semibold text-highlighted">
      Home
    </h1>
    <p class="text-muted">
      Signed in to {{ config.public.appName }} as {{ email }}.
    </p>
    <UButton
      label="Sign out"
      color="neutral"
      variant="subtle"
      @click="authStore.signOut()"
    />
  </UContainer>
</template>
