<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useHead, useRoute, useSeoMeta, useRuntimeConfig } from '#imports';
import { useAuthStore } from '@/stores/auth';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';
import { shouldOpenAddSheetOnKeydown } from '@/utils/add-concert-shortcut';

const config = useRuntimeConfig();
const route = useRoute();
const title = config.public.appName;
const description = 'A private concert log.';
const authStore = useAuthStore();
const addSheet = useAddConcertSheetStore();
const showAppChrome = computed(() => {
  if (!authStore.isAuthenticated) {
    return false;
  }

  return /^\/(home|concerts|profile|e)(\/|$)/.test(route.path);
});

const onKeydown = (event: KeyboardEvent) => {
  if (!showAppChrome.value) {
    return;
  }

  if (!shouldOpenAddSheetOnKeydown(event)) {
    return;
  }

  event.preventDefault();
  addSheet.openSheet();
};

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
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
      <UMain class="pb-[calc(var(--chrome-safe)+16px)] lg:pb-8 lg:pl-24">
        <ClientOnly>
          <AppRouteAnnouncer />
        </ClientOnly>
        <NuxtPage />
      </UMain>
      <AppAddConcertSheet />
      <AppEditEventSheet />
    </div>
    <template v-else>
      <AppHeader />
      <UMain>
        <NuxtPage />
      </UMain>
    </template>
  </UApp>
</template>
