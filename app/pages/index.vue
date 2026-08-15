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
      title="Ready to ship a new app"
      description="This template is the factory shell: auth, Pinia, tests, and agent tooling already wired."
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
        icon: 'i-lucide-smartphone',
        title: 'Installable PWA',
        description: 'Remove the PWA files with factory-new-app --no-pwa if you do not need them.'
      }]"
    />
  </div>
</template>
