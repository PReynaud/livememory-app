<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { navigateTo, useToast } from '#imports';
import { storeToRefs } from 'pinia';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';
import { useEventsStore, type EventRecord } from '@/stores/events';
import { eachCivilDateInclusive, formatDayChipParts } from '@/utils/concert-groups';
import { CONCERT_RULE_MESSAGE } from '#shared/domain/concerts';
import { eventAllowsPlaceOverride } from '#shared/domain/events';

const NEW_NIGHT = 'new:single_night';
const NEW_FESTIVAL = 'new:festival';

const sheet = useAddConcertSheetStore();
const eventsStore = useEventsStore();
const toast = useToast();
const { events } = storeToRefs(eventsStore);
const { lockEvent } = storeToRefs(sheet);

const picker = ref('');
const artist = ref('');
const eventName = ref('');
const startDate = ref('');
const endDate = ref('');
const place = ref('');
const concertDate = ref('');
const concertTime = ref('');
const stageId = ref('');
const formError = ref('');
const saving = ref(false);
const pendingChoice = ref(false);
const notes = ref('');
const confirmDelete = ref(false);
const originalEventId = ref('');
const editLoaded = ref(false);

const sheetOpen = computed({
  get: () => sheet.open,
  set: (value: boolean) => {
    if (value) {
      sheet.openSheet({
        eventId: sheet.eventId ?? undefined,
        lockEvent: sheet.lockEvent,
        concertId: sheet.concertId ?? undefined
      });
      return;
    }

    if (pendingChoice.value) {
      pendingChoice.value = false;
      return;
    }

    sheet.closeSheet();
  }
});

const selectedEvent = computed(() => {
  return events.value.find(event => event.id === picker.value) ?? null;
});

const isNewNight = computed(() => picker.value === NEW_NIGHT);
const isNewFestival = computed(() => picker.value === NEW_FESTIVAL);
const isExistingNight = computed(() => selectedEvent.value?.kind === 'single_night');
const isTransparent = computed(() => !picker.value);
const isEdit = computed(() => Boolean(sheet.concertId));
const eventLocked = computed(() => lockEvent.value && Boolean(selectedEvent.value) && !isEdit.value);
const placeLocked = computed(() => Boolean(selectedEvent.value) && !eventAllowsPlaceOverride(selectedEvent.value));
const dateLocked = computed(() => isExistingNight.value || isNewNight.value);
const sheetTitle = computed(() => (isEdit.value ? 'Edit concert' : 'Add concert'));
const eventStages = computed(() => {
  if (!selectedEvent.value) {
    return [];
  }

  return eventsStore.stagesForEvent(selectedEvent.value.id);
});
const showStageSelect = computed(() => eventStages.value.length > 0);

const eventItems = computed(() => {
  const owned = events.value.map(event => ({
    label: event.name,
    value: event.id
  }));

  if (isEdit.value) {
    return owned;
  }

  return [
    owned,
    [
      { label: 'New night', value: NEW_NIGHT },
      { label: 'New festival', value: NEW_FESTIVAL }
    ]
  ];
});

const festivalDays = computed(() => {
  if (isNewFestival.value) {
    return eachCivilDateInclusive(startDate.value, endDate.value);
  }

  if (selectedEvent.value?.kind === 'festival') {
    return eachCivilDateInclusive(selectedEvent.value.start_date, selectedEvent.value.end_date);
  }

  return [];
});

const showDayPicker = computed(() => festivalDays.value.length > 0);

const findConcert = (concertId: string) => {
  return eventsStore.currentConcerts.find(item => item.id === concertId)
    ?? eventsStore.concerts.find(item => item.id === concertId)
    ?? null;
};

const applyEvent = (event: EventRecord) => {
  eventName.value = event.name;
  startDate.value = event.start_date;
  endDate.value = event.end_date;
  place.value = event.place;
  concertDate.value = event.start_date;
};

const resetNewEventFields = () => {
  eventName.value = '';
  startDate.value = '';
  endDate.value = '';
  place.value = '';
  concertDate.value = '';
};

const focusArtist = async () => {
  await nextTick();
  const input = document.getElementById('add-concert-artist');
  if (input instanceof HTMLInputElement) {
    input.focus();
  }
};

const resetForOpen = async () => {
  formError.value = '';
  pendingChoice.value = false;
  confirmDelete.value = false;
  notes.value = '';
  artist.value = '';
  concertTime.value = '';
  stageId.value = '';
  originalEventId.value = '';
  editLoaded.value = !sheet.concertId;

  if (!sheet.eventId) {
    picker.value = '';
    resetNewEventFields();
  }

  await eventsStore.fetchEvents({ silent: true });

  if (sheet.eventId) {
    picker.value = sheet.eventId;
    const event = events.value.find(item => item.id === sheet.eventId);
    if (event) {
      applyEvent(event);
    }
  }

  if (sheet.concertId) {
    const concert = findConcert(sheet.concertId);
    if (concert) {
      picker.value = concert.event_id;
      originalEventId.value = concert.event_id;
      const event = events.value.find(item => item.id === concert.event_id);
      if (event) {
        applyEvent(event);
      }
      artist.value = concert.artist;
      concertDate.value = concert.date;
      concertTime.value = concert.time ? concert.time.slice(0, 5) : '';
      notes.value = concert.notes ?? '';
      stageId.value = concert.stage_id ?? '';
      place.value = concert.place;
    }
    editLoaded.value = true;
  }

  await focusArtist();
};

watch(() => sheet.open, (isOpen) => {
  if (isOpen) {
    void resetForOpen();
  }
});

watch(picker, (value) => {
  if (isEdit.value) {
    const event = events.value.find(item => item.id === value);
    if (event) {
      const targetStages = eventsStore.stagesForEvent(event.id);
      if (!targetStages.some(stage => stage.id === stageId.value)) {
        stageId.value = '';
      }
    }
    return;
  }

  if (value === NEW_NIGHT || value === NEW_FESTIVAL) {
    resetNewEventFields();
    return;
  }

  const event = events.value.find(item => item.id === value);
  if (event) {
    applyEvent(event);
  }
});

watch(festivalDays, (days) => {
  if (!days.length || isEdit.value) {
    return;
  }

  if (!days.includes(concertDate.value)) {
    concertDate.value = days[0] ?? '';
  }
});

const buildInput = (confirm?: 'attach' | 'create') => {
  if (isNewNight.value) {
    return {
      artist: artist.value,
      date: startDate.value,
      time: concertTime.value,
      confirm,
      newEvent: {
        kind: 'single_night' as const,
        name: eventName.value,
        startDate: startDate.value,
        place: place.value
      }
    };
  }

  if (isNewFestival.value) {
    return {
      artist: artist.value,
      date: concertDate.value,
      time: concertTime.value,
      confirm,
      newEvent: {
        kind: 'festival' as const,
        name: eventName.value,
        startDate: startDate.value,
        endDate: endDate.value,
        place: place.value
      }
    };
  }

  if (!picker.value) {
    return {
      artist: artist.value,
      date: concertDate.value,
      time: concertTime.value,
      place: place.value,
      confirm
    };
  }

  return {
    artist: artist.value,
    date: isExistingNight.value ? (selectedEvent.value?.start_date ?? concertDate.value) : concertDate.value,
    time: concertTime.value,
    place: place.value,
    stageId: stageId.value || null,
    confirm,
    eventId: picker.value
  };
};

const persist = async (mode: 'save' | 'another', confirm?: 'attach' | 'create') => {
  if (saving.value) {
    return;
  }

  saving.value = true;
  formError.value = '';

  try {
    if (isEdit.value && sheet.concertId) {
      if (!editLoaded.value) {
        return;
      }

      const targetEventId = picker.value;
      const moved = Boolean(targetEventId && targetEventId !== originalEventId.value);
      const nextDate = isExistingNight.value
        ? (selectedEvent.value?.start_date ?? concertDate.value)
        : concertDate.value;

      const result = await eventsStore.updateOwnedConcert({
        concertId: sheet.concertId,
        artist: artist.value,
        date: nextDate,
        time: concertTime.value,
        notes: notes.value,
        confirm,
        place: place.value,
        stageId: stageId.value || null,
        ...(moved && targetEventId ? { eventId: targetEventId } : {})
      });

      if (result.outcome === 'needs_choice') {
        pendingChoice.value = true;
        return;
      }

      pendingChoice.value = false;

      if (result.outcome === 'impossible_place') {
        formError.value = result.error ?? CONCERT_RULE_MESSAGE.impossiblePlace;
        return;
      }

      if (result.outcome === 'attached' && result.data) {
        const attachedToIntended
          = picker.value === result.data.event_id
            && picker.value !== NEW_NIGHT
            && picker.value !== NEW_FESTIVAL;
        if (!attachedToIntended) {
          toast.add({ title: CONCERT_RULE_MESSAGE.otherEvent });
        }

        sheet.closeSheet();
        await navigateTo('/e/' + result.data.event_id);
        return;
      }

      if (result.error) {
        formError.value = result.error;
        return;
      }

      toast.add({ title: 'Concert saved.' });
      sheet.closeSheet();
      if (moved && targetEventId) {
        await navigateTo('/e/' + targetEventId);
      }
      return;
    }

    const intendedEventId = picker.value;
    const result = await eventsStore.createOwnedConcert(buildInput(confirm));

    if (result.outcome === 'needs_choice') {
      pendingChoice.value = true;
      return;
    }

    pendingChoice.value = false;

    if (result.outcome === 'impossible_place') {
      formError.value = result.error ?? CONCERT_RULE_MESSAGE.impossiblePlace;
      return;
    }

    if (result.outcome === 'attached' && result.data) {
      const attachedToIntended
        = intendedEventId === result.data.event_id
          && intendedEventId !== NEW_NIGHT
          && intendedEventId !== NEW_FESTIVAL;
      if (!attachedToIntended) {
        toast.add({ title: CONCERT_RULE_MESSAGE.otherEvent });
      }

      sheet.closeSheet();
      await navigateTo('/e/' + result.data.event_id);
      return;
    }

    if (result.error && !result.data) {
      formError.value = result.error;
      return;
    }

    toast.add({ title: 'Concert added.' });
    const keptDate = concertDate.value;
    const keptTime = concertTime.value;
    artist.value = '';

    if (result.data) {
      picker.value = result.data.event_id;
      const event = events.value.find(item => item.id === result.data?.event_id);
      if (event) {
        applyEvent(event);
      }
    }

    if (mode === 'save') {
      sheet.closeSheet();
      return;
    }

    if (keptDate) {
      concertDate.value = keptDate;
    }
    concertTime.value = keptTime;
    await focusArtist();
  } finally {
    saving.value = false;
  }
};

const dismissChoice = () => {
  pendingChoice.value = false;
};

const requestDelete = () => {
  confirmDelete.value = true;
};

const cancelDelete = () => {
  confirmDelete.value = false;
};

const removeConcert = async () => {
  if (!sheet.concertId || saving.value) {
    return;
  }

  saving.value = true;
  formError.value = '';

  try {
    const result = await eventsStore.deleteOwnedConcert(sheet.concertId);
    if (result.error) {
      formError.value = result.error;
      return;
    }

    toast.add({ title: 'Concert deleted.' });
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
    :title="sheetTitle"
    :close="false"
    :ui="slideoverUi"
  >
    <template #body>
      <form
        class="space-y-3"
        novalidate
        @submit.prevent="persist('save')"
      >
        <UFormField
          label="Artist"
          name="artist"
        >
          <UInput
            id="add-concert-artist"
            v-model="artist"
            autofocus
            :disabled="pendingChoice"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Event"
          name="event"
        >
          <UInput
            v-if="eventLocked"
            :model-value="eventName"
            readonly
            :disabled="pendingChoice"
            class="w-full"
          />
          <USelect
            v-else
            v-model="picker"
            :items="eventItems"
            placeholder="Select an Event"
            :disabled="pendingChoice"
            class="w-full"
          />
        </UFormField>

        <template v-if="isNewNight || isNewFestival">
          <UFormField
            label="Name"
            name="name"
          >
            <UInput
              v-model="eventName"
              class="w-full"
            />
          </UFormField>
        </template>

        <UFormField
          v-if="isTransparent"
          label="Date"
          name="date"
        >
          <UInput
            v-model="concertDate"
            type="date"
            :disabled="pendingChoice"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="isNewNight || isExistingNight"
          label="Date"
          name="date"
        >
          <UInput
            v-model="startDate"
            type="date"
            :readonly="dateLocked && isExistingNight"
            :disabled="pendingChoice"
            class="w-full"
          />
        </UFormField>

        <template v-if="isNewFestival">
          <UFormField
            label="Start date"
            name="startDate"
          >
            <UInput
              v-model="startDate"
              type="date"
              :disabled="pendingChoice"
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
              :disabled="pendingChoice"
              class="w-full"
            />
          </UFormField>
        </template>

        <div
          v-if="showDayPicker"
          class="space-y-1.5"
        >
          <p class="text-[13px] text-muted">
            Day
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="day in festivalDays"
              :key="day"
              type="button"
              class="min-h-11 min-w-14 flex-1 rounded-xl border px-2 py-1.5 text-[13px] font-medium leading-tight"
              :class="concertDate === day
                ? 'border-primary bg-primary text-black'
                : 'border-white/16 bg-[rgba(10,10,10,0.88)] text-white'"
              :aria-pressed="concertDate === day"
              :aria-label="day"
              :disabled="pendingChoice"
              @click="concertDate = day"
            >
              {{ formatDayChipParts(day).weekday }}
              <span
                class="block text-[11px] font-normal"
                :class="concertDate === day ? 'text-black' : 'text-muted'"
              >
                {{ formatDayChipParts(day).rest }}
              </span>
            </button>
          </div>
        </div>

        <UFormField
          label="Place"
          name="place"
        >
          <UInput
            v-model="place"
            :readonly="placeLocked"
            :disabled="pendingChoice"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="showStageSelect"
          label="Stage or Scene"
          name="stage"
        >
          <USelect
            v-model="stageId"
            :items="eventStages.map(stage => ({ label: stage.name, value: stage.id }))"
            placeholder="Select a Stage or Scene"
            :disabled="pendingChoice"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Time"
          name="time"
        >
          <UInput
            v-model="concertTime"
            type="time"
            :disabled="pendingChoice"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="isEdit"
          label="Notes"
          name="notes"
        >
          <UTextarea
            v-model="notes"
            placeholder="Private. Never on your public profile."
            :disabled="pendingChoice"
            class="w-full"
            :rows="3"
          />
        </UFormField>

        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          :title="formError"
        />

        <template v-if="pendingChoice">
          <UAlert
            color="warning"
            variant="subtle"
            :title="CONCERT_RULE_MESSAGE.needsChoice"
          />
          <div class="flex items-center gap-4 pt-1">
            <UButton
              type="button"
              label="Attach"
              color="primary"
              variant="outline"
              class="h-11 flex-1 rounded-full ring-2"
              :loading="saving"
              @click="persist('save', 'attach')"
            />
            <UButton
              type="button"
              label="Create"
              color="neutral"
              variant="outline"
              class="h-11 flex-1 rounded-full ring-2"
              :disabled="saving"
              @click="persist('save', 'create')"
            />
            <UButton
              type="button"
              label="Cancel"
              color="neutral"
              variant="link"
              class="px-0 font-semibold text-white"
              :disabled="saving"
              @click="dismissChoice"
            />
          </div>
        </template>
        <div
          v-else
          class="flex flex-col gap-3 pt-1"
        >
          <div class="flex items-center gap-4">
            <UButton
              type="submit"
              label="Save"
              color="primary"
              variant="outline"
              class="h-11 flex-1 rounded-full ring-2"
              :loading="saving"
              :disabled="saving || (isEdit && !editLoaded)"
            />
            <UButton
              v-if="!isEdit"
              type="button"
              label="Add another"
              color="neutral"
              variant="link"
              class="px-0 font-semibold text-white"
              :disabled="saving"
              @click="persist('another')"
            />
            <UButton
              v-else-if="!confirmDelete"
              type="button"
              label="Delete"
              color="error"
              variant="link"
              class="px-0 font-semibold"
              :disabled="saving"
              @click="requestDelete"
            />
          </div>
          <div
            v-if="isEdit && confirmDelete"
            class="flex items-center gap-4"
          >
            <p class="flex-1 text-[15px] text-muted">
              Delete this concert?
            </p>
            <UButton
              type="button"
              label="Delete concert"
              color="error"
              variant="outline"
              class="h-11 rounded-full"
              :loading="saving"
              @click="removeConcert"
            />
            <UButton
              type="button"
              label="Cancel"
              color="neutral"
              variant="link"
              class="px-0 font-semibold text-white"
              :disabled="saving"
              @click="cancelDelete"
            />
          </div>
        </div>
      </form>
    </template>
  </USlideover>
</template>
