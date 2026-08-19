<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from '#imports';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';

const route = useRoute();
const addSheet = useAddConcertSheetStore();

const links = [
  { to: '/home', label: 'Home', icon: 'i-lucide-house' },
  { to: '/concerts', label: 'Concerts', icon: 'i-lucide-list' }
] as const;

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`);
const profileActive = computed(() => isActive('/profile'));
</script>

<template>
  <nav
    aria-label="Main"
    class="fixed z-50 flex bg-[rgba(20,20,20,0.72)] backdrop-blur-[24px]
      inset-x-3 bottom-2.5 h-16 flex-row items-center justify-around rounded-3xl px-1.5
      lg:inset-auto lg:bottom-auto lg:left-0 lg:top-0 lg:h-dvh lg:w-20 lg:flex-col lg:justify-start lg:gap-4 lg:rounded-none lg:py-8"
  >
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium lg:min-w-0"
      :class="isActive(link.to) ? 'text-primary' : 'text-white'"
    >
      <span
        class="flex h-7 w-12 items-center justify-center rounded-full"
        :class="isActive(link.to) ? 'bg-primary text-black' : ''"
      >
        <UIcon
          :name="link.icon"
          class="size-5"
        />
      </span>
      {{ link.label }}
    </NuxtLink>

    <button
      type="button"
      aria-label="Add concert"
      class="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-white lg:min-w-0"
      @click="addSheet.openSheet()"
    >
      <span class="flex h-8 w-11 items-center justify-center rounded-full bg-white text-black">
        <UIcon
          name="i-lucide-plus"
          class="size-5"
        />
      </span>
      Add
    </button>

    <NuxtLink
      to="/profile"
      class="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium lg:min-w-0"
      :class="profileActive ? 'text-primary' : 'text-white'"
    >
      <span
        class="flex h-7 w-12 items-center justify-center rounded-full"
        :class="profileActive ? 'bg-primary text-black' : ''"
      >
        <UIcon
          name="i-lucide-user"
          class="size-5"
        />
      </span>
      Profile
    </NuxtLink>
  </nav>
</template>
