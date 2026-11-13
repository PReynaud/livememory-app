<script setup lang="ts">
import { computed } from 'vue';
import { useSupabaseUser } from '#imports';

const supabaseUser = useSupabaseUser();
const isAuthenticated = computed(() => Boolean(supabaseUser.value));
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
      >
        <AppLogo class="size-6 shrink-0 text-[var(--fg)]" />
        <span class="text-lg font-bold tracking-tight text-[var(--fg)]">LiveMemory</span>
      </NuxtLink>
    </template>

    <template #right>
      <UButton
        v-if="isAuthenticated"
        to="/home"
        label="Home"
        color="neutral"
        variant="ghost"
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
