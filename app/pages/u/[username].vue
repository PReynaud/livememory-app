<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from '#imports';
import { useSharedListStore } from '@/stores/shared-list';
import { SHARED_LIST_EMPTY, SHARED_LIST_NOT_FOUND } from '#shared/domain/shared-list';

const route = useRoute();
const sharedListStore = useSharedListStore();
const { profile, groups, error } = storeToRefs(sharedListStore);
const hasResolved = ref(false);

const username = computed(() => {
  const value = route.params.username;
  return typeof value === 'string' ? value : '';
});

const notFound = computed(() => {
  return hasResolved.value && !profile.value && !error.value;
});

const loadFailed = computed(() => {
  return hasResolved.value && !profile.value && Boolean(error.value);
});

const isEmpty = computed(() => {
  return Boolean(profile.value) && groups.value.length === 0;
});

const loadProfile = async (handle: string) => {
  hasResolved.value = false;
  const pending = handle;
  await sharedListStore.fetchPublicProfile(pending);
  if (pending !== username.value) {
    return;
  }

  hasResolved.value = true;
};

watch(username, (handle) => {
  void loadProfile(handle);
}, { immediate: true });
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-4">
    <template v-if="profile">
      <div
        data-testid="route-announcer"
        class="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Shared list for {{ profile.username }}
      </div>
      <h1 class="text-[34px] font-bold tracking-tight leading-tight">
        {{ profile.username }}
      </h1>

      <p
        v-if="isEmpty"
        data-testid="shared-list-empty"
        class="text-muted"
      >
        {{ SHARED_LIST_EMPTY }}
      </p>

      <div
        v-else
        class="space-y-2.5"
        data-testid="shared-list-groups"
      >
        <AppEventCard
          v-for="group in groups"
          :key="group.event.id"
          :event="group.event"
          :concerts="group.concerts"
          readonly
        />
      </div>
    </template>

    <template v-else-if="!hasResolved">
      <AppListSkeleton variant="groups" />
    </template>

    <template v-else-if="loadFailed">
      <AppLoadError
        testid="shared-list-load-error"
        @retry="void loadProfile(username)"
      />
    </template>

    <template v-else-if="notFound">
      <h1 class="text-[34px] font-bold tracking-tight leading-tight">
        {{ SHARED_LIST_NOT_FOUND }}
      </h1>
    </template>
  </UContainer>
</template>
