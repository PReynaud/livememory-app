<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useToast } from '#imports';
import { storeToRefs } from 'pinia';
import { useEditEventSheetStore } from '@/stores/edit-event-sheet';
import { useEventsStore } from '@/stores/events';
import { eventAllowsPlaceOverride } from '#shared/domain/events';

type StageDraft = { id?: string; name: string };

const sheet = useEditEventSheetStore();
const eventsStore = useEventsStore();
const toast = useToast();
const { currentEvent, currentConcerts, currentStages } = storeToRefs(eventsStore);

const name = ref('');
const startDate = ref('');
const endDate = ref('');
const place = ref('');
const allowPlaceOverride = ref(false);
const stages = ref<StageDraft[]>([]);
const concertDates = ref<Record<string, string>>({});
const formError = ref('');
const saving = ref(false);

const sheetOpen = computed({
  get: () => sheet.open,
  set: (value: boolean) => {
    if (!value) {
      sheet.closeSheet();
    }
  }
});

const isFestival = computed(() => currentEvent.value?.kind === 'festival');
const hasConcerts = computed(() => currentConcerts.value.length > 0);

const fillFromEvent = () => {
  const event = currentEvent.value;
  if (!event) {
    return;
  }

  name.value = event.name;
  startDate.value = event.start_date;
  endDate.value = event.end_date;
  place.value = event.place;
  allowPlaceOverride.value = eventAllowsPlaceOverride(event);
  stages.value = currentStages.value.map(stage => ({ id: stage.id, name: stage.name }));
  concertDates.value = Object.fromEntries(
    currentConcerts.value.map(concert => [concert.id, concert.date])
  );
  formError.value = '';
};

watch(() => sheet.open, async (isOpen) => {
  if (!isOpen || !sheet.eventId) {
    return;
  }

  if (currentEvent.value?.id !== sheet.eventId) {
    await eventsStore.fetchEvent(sheet.eventId);
  }

  fillFromEvent();
});

const addStage = () => {
  stages.value = [...stages.value, { name: '' }];
};

const removeStage = (index: number) => {
  stages.value = stages.value.filter((_, stageIndex) => stageIndex !== index);
};

const persist = async () => {
  if (!sheet.eventId || saving.value) {
    return;
  }

  saving.value = true;
  formError.value = '';

  try {
    const event = currentEvent.value;
    const movedNight = event?.kind === 'single_night' && startDate.value !== event.start_date;
    const datePatches = currentConcerts.value
      .map((concert) => {
        const nextDate = movedNight
          ? startDate.value
          : (concertDates.value[concert.id] ?? concert.date);
        return {
          concertId: concert.id,
          date: nextDate
        };
      })
      .filter(patch => patch.date !== currentConcerts.value.find(concert => concert.id === patch.concertId)?.date);

    const result = await eventsStore.updateOwnedEvent({
      eventId: sheet.eventId,
      name: name.value,
      startDate: startDate.value,
      endDate: isFestival.value ? endDate.value : startDate.value,
      place: place.value,
      allowPlaceOverride: allowPlaceOverride.value,
      stages: stages.value,
      concertDates: datePatches.length > 0 ? datePatches : undefined
    });

    if (result.error) {
      formError.value = result.error;
      return;
    }

    toast.add({ title: 'Event saved.' });
    sheet.closeSheet();
  } finally {
    saving.value = false;
  }
};

const slideoverUi = {
  overlay: 'bg-white/8',
  content: 'bg-[rgba(20,20,20,0.78)] backdrop-blur-[28px] divide-y-0 ring-0 shadow-none rounded-t-3xl inset-x-0 bottom-[4.75rem] lg:bottom-8 lg:inset-x-auto lg:left-1/2 lg:w-[28rem] lg:-translate-x-1/2 max-h-[min(85dvh,36rem)]',
  header: 'px-4 pt-4 pb-0 sm:px-4',
  body: 'px-4 py-3 sm:px-4 sm:py-3',
  footer: 'px-4 pb-4 sm:px-4',
  title: 'text-base font-semibold'
};
</script>

<template>
  <USlideover
    v-model:open="sheetOpen"
    side="bottom"
    title="Edit event"
    :close="false"
    :ui="slideoverUi"
  >
    <template #body>
      <form
        class="space-y-3"
        novalidate
        @submit.prevent="persist"
      >
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

        <UFormField
          label="Allow a different Place on each Concert"
          name="allowPlaceOverride"
        >
          <USwitch v-model="allowPlaceOverride" />
        </UFormField>

        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[13px] text-muted">
              Stage or Scene
            </p>
            <UButton
              type="button"
              label="Add stage"
              color="neutral"
              variant="link"
              class="px-0 font-semibold text-white"
              @click="addStage"
            />
          </div>
          <UFormField
            v-for="(stage, index) in stages"
            :key="stage.id ?? `new-${index}`"
            :label="`Stage ${index + 1}`"
            :name="`stage-${index}`"
          >
            <div class="flex items-center gap-2">
              <UInput
                v-model="stage.name"
                class="w-full"
              />
              <UButton
                type="button"
                label="Remove"
                color="neutral"
                variant="link"
                class="px-0 font-semibold text-white"
                @click="removeStage(index)"
              />
            </div>
          </UFormField>
        </div>

        <div
          v-if="hasConcerts && isFestival"
          class="space-y-2"
        >
          <p class="text-[13px] text-muted">
            Concert dates
          </p>
          <UFormField
            v-for="concert in currentConcerts"
            :key="concert.id"
            :label="concert.artist"
            :name="`concert-date-${concert.id}`"
          >
            <UInput
              v-model="concertDates[concert.id]"
              type="date"
              class="w-full"
            />
          </UFormField>
        </div>

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
          class="h-11 w-full rounded-full ring-2"
          :loading="saving"
        />
      </form>
    </template>
  </USlideover>
</template>
