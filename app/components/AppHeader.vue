<script setup lang="ts">
import { computed } from 'vue';
import { useRuntimeConfig } from '#imports';

const config = useRuntimeConfig();
const appName = computed(() => config.public.appName);
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
      <UButton
        to="/login"
        label="Sign in"
        color="neutral"
        variant="ghost"
      />
    </template>
  </UHeader>
</template>
