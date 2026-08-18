<script setup lang="ts">
import { computed } from 'vue';
import { useHead, useRoute, useSeoMeta, useRuntimeConfig } from '#imports';
import { useAuthStore } from '@/stores/auth';

const config = useRuntimeConfig();
const route = useRoute();
const title = config.public.appName;
const description = 'A private concert log.';
const authStore = useAuthStore();
const showAppChrome = computed(() => {
  if (!authStore.isAuthenticated) {
    return false;
  }

  return /^\/(home|concerts|profile)(\/|$)/.test(route.path);
});

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en',
    class: 'dark'
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
    <div
      v-if="showAppChrome"
      class="min-h-dvh bg-default"
    >
      <AppGlassNav />
      <UMain class="pb-24 lg:pb-8 lg:pl-24">
        <NuxtPage />
      </UMain>
    </div>
    <template v-else>
      <AppHeader />
      <UMain>
        <NuxtPage />
      </UMain>
    </template>
  </UApp>
</template>
