<script setup lang="ts">
import { computed, ref } from 'vue';
import { definePageMeta, navigateTo } from '#imports';
import { storeToRefs } from 'pinia';
import { useEventsStore, type EventKind } from '@/stores/events';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';

definePageMeta({
  middleware: 'auth'
});

const eventsStore = useEventsStore();
const addSheet = useAddConcertSheetStore();
const {
  events,
  visibleEvents,
  loading,
  loadingMore,
  error,
  hasMoreEvents
} = storeToRefs(eventsStore);

const createKind = ref<EventKind | null>(null);
const name = ref('');
const startDate = ref('');
const endDate = ref('');
const place = ref('');
const formError = ref('');
const saving = ref(false);

const hasEvents = computed(() => events.value.length > 0);
const isFestival = computed(() => createKind.value === 'festival');
const showSkeleton = computed(() => loading.value && !error.value && !hasEvents.value);

const openCreate = (kind: EventKind) => {
  createKind.value = kind;
  formError.value = '';
};

const submitCreate = async () => {
  if (!createKind.value || saving.value) {
    return;
  }

  saving.value = true;
  formError.value = '';

  try {
    const result = await eventsStore.createOwnedEvent({
      kind: createKind.value,
      name: name.value,
      startDate: startDate.value,
      endDate: isFestival.value ? endDate.value : startDate.value,
      place: place.value
    });

    if (result.error) {
      formError.value = result.error;
      return;
    }

    if (result.data) {
      await navigateTo(`/e/${result.data.id}`);
    }
  } finally {
    saving.value = false;
  }
};

const retryLoad = () => {
  if (hasEvents.value) {
    void eventsStore.loadMoreEvents();
    return;
  }

  void eventsStore.fetchEvents();
};

void eventsStore.fetchEvents({ silent: eventsStore.events.length > 0 });
</script>

<template>
  <UContainer class="py-8 max-w-lg space-y-4">
    <h1 class="text-[34px] font-bold tracking-tight leading-tight">
      Concerts
    </h1>

    <div class="flex flex-wrap gap-2">
      <UButton
        label="New night"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        @click="openCreate('single_night')"
      />
      <UButton
        label="New festival"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        @click="openCreate('festival')"
      />
    </div>

    <form
      v-if="createKind"
      class="rounded-2xl bg-[#1A1A1A] p-4 space-y-3"
      novalidate
      @submit.prevent="submitCreate"
    >
      <p class="text-base font-semibold">
        {{ isFestival ? 'New festival' : 'New night' }}
      </p>

      <UFormField
        label="Name"
        name="name"
      >
        <UInput
          v-model="name"
          class="w-full"
        />
      </UFormField>

      <UFormField
        v-if="!isFestival"
        label="Date"
        name="date"
      >
        <UInput
          v-model="startDate"
          type="date"
          class="w-full"
        />
      </UFormField>

      <template v-else>
        <UFormField
          label="Start date"
          name="startDate"
        >
          <UInput
            v-model="startDate"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="End date"
          name="endDate"
        >
          <UInput
            v-model="endDate"
            type="date"
            class="w-full"
          />
        </UFormField>
      </template>

      <UFormField
        label="Place"
        name="place"
      >
        <UInput
          v-model="place"
          class="w-full"
        />
      </UFormField>

      <UAlert
        v-if="formError"
        color="error"
        variant="subtle"
        :title="formError"
      />

      <UButton
        type="submit"
        label="Save"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        :loading="saving"
      />
    </form>

    <AppListSkeleton
      v-if="showSkeleton"
      variant="groups"
    />

    <AppLoadError
      v-else-if="error && !formError"
      testid="concerts-load-error"
      @retry="retryLoad"
    />

    <section
      v-else-if="!hasEvents"
      class="rounded-2xl bg-[#1A1A1A] p-4 space-y-3"
    >
      <p class="text-lg font-semibold">
        No shows yet.
      </p>
      <UButton
        label="Add concert"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        @click="addSheet.openSheet()"
      />
    </section>

    <div
      v-if="hasEvents && !showSkeleton"
      class="space-y-2.5"
    >
      <AppEventCard
        v-for="event in visibleEvents"
        :key="event.id"
        :event="event"
        :concerts="eventsStore.concertsForEvent(event.id)"
      />
      <p
        v-if="loadingMore"
        data-testid="loading-more"
        class="text-sm text-muted"
      >
        Loading more
      </p>
      <UButton
        v-else-if="hasMoreEvents && !error"
        label="Load more"
        color="neutral"
        variant="ghost"
        class="w-full"
        @click="void eventsStore.loadMoreEvents()"
      />
    </div>
  </UContainer>
</template>
