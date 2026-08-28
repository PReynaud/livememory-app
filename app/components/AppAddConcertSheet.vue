<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { navigateTo, useToast } from '#imports';
import { storeToRefs } from 'pinia';
import { useAddConcertSheetStore } from '@/stores/add-concert-sheet';
import { useEditEventSheetStore } from '@/stores/edit-event-sheet';
import { useEventsStore, type EventRecord } from '@/stores/events';
import { eachCivilDateInclusive, formatDayChipParts } from '@/utils/concert-groups';
import { CONCERT_RULE_MESSAGE, transparentSingleNightName } from '#shared/domain/concerts';
import { eventAllowsPlaceOverride } from '#shared/domain/events';
import { JOINER_IMPACT_COPY } from '#shared/domain/membership';
import { CATALOG_KIND } from '#shared/domain/catalog';
import { useNameCatalogStore } from '@/stores/name-catalog';
import { formatEventDateLabel } from '@/utils/event-dates';

const NEW_NIGHT = 'new:single_night';
const NEW_FESTIVAL = 'new:festival';

const sheet = useAddConcertSheetStore();
const editEventSheet = useEditEventSheetStore();
const eventsStore = useEventsStore();
const catalog = useNameCatalogStore();
const toast = useToast();
const { events, sessionUserId } = storeToRefs(eventsStore);
const { lockEvent } = storeToRefs(sheet);

const picker = ref('');
const artists = ref<string[]>(['']);
const eventName = ref('');
const startDate = ref('');
const endDate = ref('');
const place = ref('');
const concertDate = ref('');
const concertTime = ref('');
const stageName = ref('');
const formError = ref('');
const saving = ref(false);
const pendingChoice = ref(false);
const notes = ref('');
const confirmDelete = ref(false);
const confirmMove = ref(false);
const hasJoiners = ref(false);
const originalEventId = ref('');
const editLoaded = ref(false);
const artistSuggestions = ref<string[]>([]);
const placeSuggestions = ref<string[]>([]);

const artist = computed({
  get: () => artists.value[0] ?? '',
  set: (value: string) => {
    artists.value = [value, ...artists.value.slice(1)];
  }
});

let catalogTimer: ReturnType<typeof setTimeout> | null = null;

const sheetOpen = computed({
  get: () => sheet.open,
  set: (value: boolean) => {
    if (value) {
      editEventSheet.closeSheet();
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

watch(() => sheet.open, (isOpen) => {
  if (isOpen) {
    editEventSheet.closeSheet();
  }
});

const selectedEvent = computed(() => {
  return events.value.find(event => event.id === picker.value) ?? null;
});

const isNewNight = computed(() => picker.value === NEW_NIGHT);
const isNewFestival = computed(() => picker.value === NEW_FESTIVAL);
const isExistingNight = computed(() => selectedEvent.value?.kind === 'single_night');
const isEdit = computed(() => Boolean(sheet.concertId));
const eventLocked = computed(() => {
  return lockEvent.value && Boolean(sheet.eventId || selectedEvent.value) && !isEdit.value;
});
const placeLocked = computed(() => Boolean(selectedEvent.value) && !eventAllowsPlaceOverride(selectedEvent.value));
const dateLocked = computed(() => isExistingNight.value || isNewNight.value);
const sheetTitle = computed(() => (isEdit.value ? 'Edit concert' : 'Add concert'));
const concertDeleteCopy = computed(() => {
  return hasJoiners.value ? JOINER_IMPACT_COPY.deleteConcert : 'Delete this concert?';
});
const eventStages = computed(() => {
  if (!selectedEvent.value) {
    return [];
  }

  return eventsStore.stagesForEvent(selectedEvent.value.id);
});
const showAddAnotherArtist = computed(() => !isEdit.value && artist.value.trim().length > 0);
const eventFieldInvalid = computed(() => formError.value === CONCERT_RULE_MESSAGE.requiredEvent);
const artistFieldInvalid = computed(() => formError.value === CONCERT_RULE_MESSAGE.requiredArtist);
const dateFieldInvalid = computed(() => formError.value === CONCERT_RULE_MESSAGE.requiredDate);
const placeFieldInvalid = computed(() => formError.value === CONCERT_RULE_MESSAGE.requiredPlace);
const saveLabel = computed(() => (saving.value ? 'Saving…' : 'Save'));
const eventContextMeta = computed(() => {
  if (!selectedEvent.value) {
    return '';
  }

  return [formatEventDateLabel(selectedEvent.value), selectedEvent.value.place]
    .filter(Boolean)
    .join(' · ');
});
const stageItems = computed(() => eventStages.value.map(stage => stage.name));

const eventItems = computed(() => {
  const owned = events.value
    .filter(event => Boolean(sessionUserId.value) && event.owner_id === sessionUserId.value)
    .map(event => ({
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

const searchCatalog = (
  kind: typeof CATALOG_KIND.artist | typeof CATALOG_KIND.place,
  term: string
) => {
  if (catalogTimer) {
    clearTimeout(catalogTimer);
  }

  catalogTimer = setTimeout(() => {
    void catalog.searchNames(kind, term).then((result) => {
      if (kind === CATALOG_KIND.artist) {
        artistSuggestions.value = result.data;
      } else {
        placeSuggestions.value = result.data;
      }
    });
  }, 200);
};

const addArtistRow = () => {
  artists.value = [...artists.value, ''];
};

const setArtistAt = (index: number, value: unknown) => {
  const next = [...artists.value];
  next[index] = String(value ?? '');
  artists.value = next;
};

const onArtistSearch = (index: number, term: string) => {
  setArtistAt(index, term);
  searchCatalog(CATALOG_KIND.artist, term);
};

const removeArtistRow = (index: number) => {
  if (index === 0) {
    return;
  }

  artists.value = artists.value.filter((_, rowIndex) => rowIndex !== index);
};

const focusArtist = async () => {
  await nextTick();
  const input = document.getElementById(eventLocked.value ? 'add-concert-artist' : 'add-concert-event');
  if (input instanceof HTMLInputElement || input instanceof HTMLButtonElement) {
    input.focus();
  }
};

const resetForOpen = async () => {
  formError.value = '';
  pendingChoice.value = false;
  confirmDelete.value = false;
  confirmMove.value = false;
  hasJoiners.value = false;
  notes.value = '';
  artists.value = [''];
  concertTime.value = '';
  stageName.value = '';
  artistSuggestions.value = [];
  placeSuggestions.value = [];
  originalEventId.value = '';
  editLoaded.value = !sheet.concertId;

  if (sheet.eventId) {
    picker.value = sheet.eventId;
  } else {
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
      stageName.value = concert.stage_name ?? eventStages.value.find(stage => stage.id === concert.stage_id)?.name ?? '';
      place.value = concert.place;
    }
    editLoaded.value = true;

    if (originalEventId.value) {
      const joiners = await eventsStore.eventHasJoiners(originalEventId.value);
      hasJoiners.value = Boolean(joiners.data);
    }
  }

  await focusArtist();
};

const onDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !sheet.open || !pendingChoice.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  pendingChoice.value = false;
};

watch(() => sheet.open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', onDocumentKeydown, true);
    void resetForOpen();
    return;
  }

  window.removeEventListener('keydown', onDocumentKeydown, true);
});

watch(picker, (value) => {
  confirmMove.value = false;

  if (isEdit.value) {
    const event = events.value.find(item => item.id === value);
    if (event) {
      const targetStages = eventsStore.stagesForEvent(event.id);
      if (!targetStages.some(stage => stage.name === stageName.value)) {
        stageName.value = '';
      }
    }
    return;
  }

  if (value === NEW_NIGHT || value === NEW_FESTIVAL) {
    resetNewEventFields();
    if (value === NEW_FESTIVAL) {
      stageName.value = '';
    }
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

const resolvedNightName = () => {
  const named = eventName.value.trim();
  if (named) {
    return named;
  }

  return transparentSingleNightName(
    isNewFestival.value ? startDate.value : (startDate.value || concertDate.value),
    place.value,
    stageName.value
  );
};

const buildInput = (artistName: string, confirm?: 'attach' | 'create') => {
  const stage = stageName.value.trim() || null;

  if (isNewNight.value) {
    return {
      artist: artistName,
      date: startDate.value,
      time: concertTime.value,
      confirm,
      stageName: stage,
      newEvent: {
        kind: 'single_night' as const,
        name: resolvedNightName(),
        startDate: startDate.value,
        place: place.value
      }
    };
  }

  if (isNewFestival.value) {
    return {
      artist: artistName,
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

  return {
    artist: artistName,
    date: isExistingNight.value ? (selectedEvent.value?.start_date ?? concertDate.value) : concertDate.value,
    time: concertTime.value,
    place: place.value,
    stageName: stage,
    confirm,
    eventId: picker.value || sheet.eventId || undefined
  };
};

const persist = async (confirm?: 'attach' | 'create') => {
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

      if (moved && targetEventId && !confirmMove.value) {
        const impact = await eventsStore.concertMoveWouldLoseJoiners(
          originalEventId.value,
          targetEventId
        );
        if (impact.error) {
          formError.value = impact.error;
          return;
        }

        if (impact.data) {
          confirmMove.value = true;
          return;
        }
      }

      const result = await eventsStore.updateOwnedConcert({
        concertId: sheet.concertId,
        artist: artist.value,
        date: nextDate,
        time: concertTime.value,
        notes: notes.value,
        confirm,
        place: place.value,
        stageName: stageName.value.trim() || null,
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

    if (!picker.value && !sheet.eventId) {
      formError.value = CONCERT_RULE_MESSAGE.requiredEvent;
      return;
    }

    if (!picker.value && sheet.eventId) {
      picker.value = sheet.eventId;
    }

    const names = artists.value.map(name => name.trim()).filter(Boolean);
    if (names.length === 0) {
      formError.value = CONCERT_RULE_MESSAGE.requiredArtist;
      return;
    }

    const intendedEventId = picker.value;
    const openingNewEvent = isNewNight.value || isNewFestival.value;
    let createdEventId: string | null = null;

    for (const [index, name] of names.entries()) {
      const result = await eventsStore.createOwnedConcert(
        createdEventId
          ? {
              artist: name,
              date: isNewFestival.value ? concertDate.value : startDate.value,
              time: concertTime.value,
              place: place.value,
              stageName: isNewFestival.value ? null : (stageName.value.trim() || null),
              confirm: index === 0 ? confirm : undefined,
              eventId: createdEventId
            }
          : buildInput(name, index === 0 ? confirm : undefined)
      );

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

      if (result.data && openingNewEvent && !createdEventId) {
        createdEventId = result.data.event_id;
      }
    }

    toast.add({ title: names.length > 1 ? 'Concerts added.' : 'Concert added.' });

    if (createdEventId) {
      picker.value = createdEventId;
    }

    sheet.closeSheet();
  } finally {
    saving.value = false;
  }
};

const dismissChoice = () => {
  pendingChoice.value = false;
};

const requestDelete = async () => {
  if (originalEventId.value) {
    const joiners = await eventsStore.eventHasJoiners(originalEventId.value);
    if (joiners.error) {
      formError.value = joiners.error;
      return;
    }

    hasJoiners.value = Boolean(joiners.data);
  }

  confirmDelete.value = true;
};

const cancelDelete = () => {
  confirmDelete.value = false;
};

const cancelMove = () => {
  confirmMove.value = false;
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
  overlay: 'bg-elevated/0',
  content: 'lm-chrome lm-sheet-shell bg-default/50 backdrop-blur-[24px] divide-y-0 ring-0 shadow-none rounded-t-3xl inset-x-0 bottom-[4.75rem] lg:bottom-8 lg:inset-x-auto lg:left-24 lg:right-0 lg:mx-auto lg:w-[28rem] max-h-[min(85dvh,36rem)]',
  header: 'lm-sheet-head relative flex-col items-stretch gap-0 px-4 pt-6 pb-0 sm:px-4 min-h-0',
  body: 'min-h-0 overflow-y-auto px-4 py-3 sm:px-4 sm:py-3',
  footer: 'lm-sheet-foot px-4 pb-4 sm:px-4',
  wrapper: 'flex min-h-0 flex-col',
  title: 'text-lg font-bold tracking-tight order-2 pb-3',
  description: 'sheet-eyebrow order-1'
};
</script>

<template>
  <USlideover
    v-model:open="sheetOpen"
    side="bottom"
    :title="sheetTitle"
    :description="isEdit ? undefined : 'New'"
    :close="false"
    :ui="slideoverUi"
  >
    <template #body>
      <form
        id="add-concert-form"
        class="space-y-2.5"
        novalidate
        @submit.prevent="persist()"
      >
        <section class="lm-form-panel space-y-2.5">
          <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Event
          </p>
          <div
            v-if="selectedEvent"
            class="lm-event-context"
            aria-live="polite"
          >
            <span class="font-semibold text-white">{{ selectedEvent.name }}</span>
            <span class="text-muted">{{ eventContextMeta }}</span>
          </div>
          <UFormField
            name="event"
            required
            description="The night or festival this concert belongs to."
            :error="eventFieldInvalid"
          >
            <template #label>
              <span class="inline-flex items-center gap-1">
                Event
                <UPopover>
                  <UButton
                    icon="i-lucide-info"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    square
                    aria-label="What is an Event?"
                  />
                  <template #content>
                    <div class="max-w-72 space-y-2 p-3 text-[13px] text-muted">
                      <p>
                        <span class="font-semibold text-white">Night</span>
                        — one date, one city. Examples: a club show; a soirée with several artists.
                      </p>
                      <p>
                        <span class="font-semibold text-white">Festival</span>
                        — several days, often several stages. Example: Rock en Seine.
                      </p>
                      <p>
                        New night without a custom name becomes Concerts on the date at the venue and city.
                      </p>
                    </div>
                  </template>
                </UPopover>
              </span>
            </template>
            <UInput
              v-if="eventLocked"
              id="add-concert-event"
              :model-value="eventName"
              readonly
              :disabled="pendingChoice"
              class="w-full"
              :aria-invalid="eventFieldInvalid || undefined"
            />
            <USelect
              v-else
              id="add-concert-event"
              v-model="picker"
              :items="eventItems"
              placeholder="Select an Event"
              :disabled="pendingChoice"
              class="w-full"
              :aria-invalid="eventFieldInvalid || undefined"
            />
          </UFormField>

          <template v-if="isNewNight || isNewFestival">
            <UFormField
              :label="isNewFestival ? 'Name' : 'Name'"
              name="name"
              :description="isNewNight ? 'Leave blank to name from date, venue, and city.' : undefined"
            >
              <UInput
                v-model="eventName"
                class="w-full"
              />
            </UFormField>
          </template>
        </section>

        <section class="lm-form-panel lm-form-panel-artist space-y-2.5">
          <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Artist
          </p>
          <div
            v-for="(name, index) in artists"
            :key="`artist-${index}`"
            class="flex items-end gap-2"
          >
            <UFormField
              :label="index === 0 ? 'Artist' : `Artist ${index + 1}`"
              :name="`artist-${index}`"
              required
              class="min-w-0 flex-1"
              :error="index === 0 && artistFieldInvalid"
            >
              <UInputMenu
                :id="index === 0 ? 'add-concert-artist' : undefined"
                :model-value="name"
                mode="autocomplete"
                :items="artistSuggestions"
                :disabled="pendingChoice"
                :content="{ hideWhenEmpty: true }"
                class="w-full"
                :aria-invalid="index === 0 && artistFieldInvalid ? true : undefined"
                @update:model-value="setArtistAt(index, $event)"
                @update:search-term="onArtistSearch(index, $event)"
              />
            </UFormField>
            <UButton
              v-if="index > 0"
              type="button"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              square
              aria-label="Remove artist"
              :disabled="pendingChoice"
              @click="removeArtistRow(index)"
            />
          </div>

          <UButton
            v-if="showAddAnotherArtist"
            type="button"
            label="Add another artist"
            color="neutral"
            variant="link"
            class="px-0 font-semibold text-white"
            :disabled="pendingChoice"
            @click="addArtistRow"
          />
        </section>

        <section class="lm-form-panel space-y-2.5">
          <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Details
          </p>

          <template v-if="isNewFestival">
            <UFormField
              label="Start date"
              name="startDate"
              required
            >
              <UInput
                v-model="startDate"
                type="date"
                :disabled="pendingChoice"
                class="h-11 w-full"
              />
            </UFormField>
            <UFormField
              label="End date"
              name="endDate"
              required
            >
              <UInput
                v-model="endDate"
                type="date"
                :disabled="pendingChoice"
                class="h-11 w-full"
              />
            </UFormField>
          </template>

          <div
            v-if="showDayPicker"
            class="space-y-1.5"
            :aria-invalid="dateFieldInvalid || undefined"
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

          <div
            class="field-row"
            :class="{ 'time-only': isNewFestival }"
          >
            <UFormField
              v-if="isNewNight || isExistingNight"
              label="Date"
              name="date"
              required
              class="min-w-0"
              :error="dateFieldInvalid"
            >
              <UInput
                v-model="startDate"
                type="date"
                :readonly="dateLocked && isExistingNight"
                :disabled="pendingChoice"
                class="h-11 w-full"
                :aria-invalid="dateFieldInvalid || undefined"
              />
            </UFormField>
            <UFormField
              v-else-if="!isNewFestival"
              label="Date"
              name="date"
              required
              class="min-w-0"
              :error="dateFieldInvalid"
            >
              <UInput
                v-model="concertDate"
                type="date"
                :disabled="pendingChoice"
                class="h-11 w-full"
                :aria-invalid="dateFieldInvalid || undefined"
              />
            </UFormField>
            <UFormField
              label="Time"
              name="time"
              class="min-w-0"
            >
              <UInput
                v-model="concertTime"
                type="time"
                :disabled="pendingChoice"
                class="h-11 w-full"
              />
            </UFormField>
          </div>

          <UFormField
            label="City"
            name="place"
            required
            :error="placeFieldInvalid"
          >
            <UInputMenu
              v-model="place"
              mode="autocomplete"
              :items="placeSuggestions"
              placeholder="City"
              :readonly="placeLocked"
              :disabled="pendingChoice"
              :content="{ hideWhenEmpty: true }"
              class="w-full"
              :aria-invalid="placeFieldInvalid || undefined"
              @update:search-term="searchCatalog(CATALOG_KIND.place, $event)"
            />
          </UFormField>

          <UFormField
            v-if="!isNewFestival"
            label="Stage or Scene"
            name="stage"
          >
            <UInputMenu
              v-model="stageName"
              mode="autocomplete"
              :items="stageItems"
              placeholder="Venue or stage"
              :disabled="pendingChoice"
              :content="{ hideWhenEmpty: true }"
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
        </section>
      </form>
    </template>
    <template #footer>
      <UAlert
        v-if="formError"
        color="error"
        variant="subtle"
        role="alert"
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
            class="h-11 flex-1 justify-center rounded-full ring-2"
            :loading="saving"
            @click="persist('attach')"
          />
          <UButton
            type="button"
            label="Create"
            color="neutral"
            variant="outline"
            class="h-11 flex-1 justify-center rounded-full ring-2"
            :disabled="saving"
            @click="persist('create')"
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
        class="flex flex-col gap-3"
      >
        <div class="flex items-center gap-4">
          <UButton
            type="submit"
            form="add-concert-form"
            :label="saveLabel"
            color="primary"
            variant="outline"
            class="h-11 flex-1 justify-center rounded-full ring-2"
            :disabled="saving || (isEdit && !editLoaded) || confirmMove"
            :aria-busy="saving || undefined"
          />
          <UButton
            v-if="isEdit && !confirmDelete"
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
            {{ concertDeleteCopy }}
          </p>
          <UButton
            type="button"
            label="Delete concert"
            color="error"
            variant="outline"
            class="h-11 justify-center rounded-full"
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
        <div
          v-if="isEdit && confirmMove"
          class="flex items-center gap-4"
        >
          <p class="flex-1 text-[15px] text-muted">
            {{ JOINER_IMPACT_COPY.moveConcert }}
          </p>
          <UButton
            type="button"
            label="Move concert"
            color="error"
            variant="outline"
            class="h-11 justify-center rounded-full"
            :loading="saving"
            @click="persist()"
          />
          <UButton
            type="button"
            label="Cancel"
            color="neutral"
            variant="link"
            class="px-0 font-semibold text-white"
            :disabled="saving"
            @click="cancelMove"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
