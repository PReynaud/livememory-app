<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from '#imports';
import { storeToRefs } from 'pinia';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';
import { useAgentChatStore } from '@/stores/agent-chat';

const route = useRoute();
const addSheet = useAddConcertSheetStore();
const agentChat = useAgentChatStore();
const { isReady: isAssistantReady, open: assistantOpen } = storeToRefs(agentChat);

const links = [
  { to: '/home', label: 'Home', icon: 'i-lucide-house' },
  { to: '/concerts', label: 'Concerts', icon: 'i-lucide-list' }
] as const;

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`);
const profileActive = computed(() => isActive('/profile'));

const itemClass = (active: boolean) => active ? 'text-[var(--focus)]' : 'text-[var(--fg)]';
const pillClass = (active: boolean) => active
  ? 'ring-1 ring-[var(--focus)] bg-[color-mix(in_oklch,var(--focus)_12%,transparent)]'
  : '';
</script>

<template>
  <nav
    aria-label="Main"
    class="lm-chrome fixed z-50 flex border border-[color-mix(in_oklch,var(--fg)_8%,transparent)] bg-[var(--glass)] backdrop-blur-[24px]
      inset-x-3 bottom-2.5 mx-auto h-16 w-auto max-w-[calc(var(--max-w)-24px)] flex-row items-center justify-around rounded-3xl px-1.5
      lg:inset-auto lg:bottom-auto lg:left-0 lg:top-0 lg:mx-0 lg:h-dvh lg:w-20 lg:max-w-none lg:flex-col lg:justify-start lg:gap-4 lg:rounded-none lg:border-0 lg:border-r lg:py-8"
  >
    <span
      class="hidden h-11 items-center justify-center text-[var(--fg)] lg:flex"
      aria-hidden="true"
    >
      <AppLogo class="size-8" />
    </span>

    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      :aria-current="isActive(link.to) ? 'page' : undefined"
      class="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium lg:min-w-0"
      :class="itemClass(isActive(link.to))"
    >
      <span
        class="flex h-7 w-12 items-center justify-center rounded-full"
        :class="pillClass(isActive(link.to))"
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
      class="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[var(--fg)] lg:min-w-0"
      @click="addSheet.openSheet()"
    >
      <span class="flex h-8 w-11 items-center justify-center rounded-full border-2 border-primary text-primary">
        <UIcon
          name="i-lucide-plus"
          class="size-5"
        />
      </span>
      Add
    </button>

    <button
      v-if="isAssistantReady"
      type="button"
      aria-label="Ask assistant"
      :aria-expanded="assistantOpen ? 'true' : 'false'"
      data-testid="nav-assistant-action"
      class="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium lg:min-w-0"
      :class="itemClass(assistantOpen)"
      @click="agentChat.open = true"
    >
      <span
        class="flex h-7 w-12 items-center justify-center rounded-full"
        :class="pillClass(assistantOpen)"
      >
        <UIcon
          name="i-lucide-sparkles"
          class="size-5"
        />
      </span>
      Assistant
    </button>

    <NuxtLink
      to="/profile"
      :aria-current="profileActive ? 'page' : undefined"
      class="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium lg:min-w-0"
      :class="itemClass(profileActive)"
    >
      <span
        class="flex h-7 w-12 items-center justify-center rounded-full"
        :class="pillClass(profileActive)"
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
