<script setup lang="ts">
import { computed } from 'vue';
import { useRuntimeConfig } from '#imports';

const config = useRuntimeConfig();
const appName = computed(() => config.public.appName);
</script>

<template>
  <div>
    <UPageHero
      :title="appName"
      description="Start here. Sign in to reach the authenticated home, then grow the product through BMAD specs, tests, and implementation."
      :links="[{
        label: 'Sign in',
        to: '/login',
        trailingIcon: 'i-lucide-arrow-right',
        size: 'xl'
      }, {
        label: 'How it works',
        to: '#features',
        size: 'xl',
        color: 'neutral',
        variant: 'subtle'
      }]"
    />

    <UPageSection
      id="features"
      title="Ready to grow LiveMemory App"
      description="This factory shell already wires auth, Pinia, tests, and agent tooling. Product features land through BMAD."
      :features="[{
        icon: 'i-lucide-shield-check',
        title: 'Supabase auth',
        description: 'Email and password with RLS-ready profiles from the first migration.'
      }, {
        icon: 'i-lucide-layers',
        title: 'Pinia stores',
        description: 'Shared state and remote fetching live in stores, not in pages.'
      }, {
        icon: 'i-lucide-flask-conical',
        title: 'Tests first',
        description: 'Vitest for stores and helpers, Playwright against local Supabase.'
      }, {
        icon: 'i-lucide-map',
        title: 'BMAD delivery',
        description: 'Specs, stories, and implementation stay in the factory workflow.'
      }]"
    />
  </div>
</template>
