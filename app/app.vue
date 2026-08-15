<script setup lang="ts">
import { useHead, useSeoMeta, useRuntimeConfig } from '#imports';

const config = useRuntimeConfig();
const title = config.public.appName;
const description = 'A Nuxt app with Supabase authentication.';

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
});

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary'
});
</script>

<template>
  <UApp>
    <AppHeader />
    <UMain>
      <NuxtPage />
    </UMain>
    <USeparator />
    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          {{ title }} • © {{ new Date().getFullYear() }}
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
