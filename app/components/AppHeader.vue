<script setup lang="ts">
import { computed } from 'vue';
import { useRuntimeConfig } from '#imports';
import { useAuthStore } from '@/stores/auth';

const config = useRuntimeConfig();
const appName = computed(() => config.public.appName);
const authStore = useAuthStore();
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
      >
        <AppLogo class="w-auto h-6 shrink-0" />
        <span class="font-semibold text-highlighted">{{ appName }}</span>
      </NuxtLink>
    </template>

    <template #right>
      <UColorModeButton />

      <UButton
        v-if="authStore.isAuthenticated"
        to="/home"
        label="Home"
        color="neutral"
        variant="ghost"
      />

      <UButton
        v-if="authStore.isAuthenticated"
        label="Sign out"
        color="neutral"
        variant="ghost"
        @click="authStore.signOut()"
      />

      <UButton
        v-else
        to="/login"
        label="Sign in"
        color="neutral"
        variant="ghost"
      />
    </template>
  </UHeader>
</template>
