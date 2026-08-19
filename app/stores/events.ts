import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabaseClient } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import type { Database } from '@/types/database.types';
import {
  createEvent,
  getOwnedEvent,
  listOwnedEvents,
  type CreateEventInput,
  type EventKind,
  type EventRecord,
  type EventsClient
} from '#shared/domain/events';
import {
  createConcert,
  listConcertsForEvent,
  listOwnedConcerts,
  type ConcertRecord,
  type ConcertsClient,
  type CreateConcertInput
} from '#shared/domain/concerts';

export type { ConcertRecord, CreateConcertInput, CreateEventInput, EventKind, EventRecord };

export const useEventsStore = defineStore('events', () => {
  const supabase = useSupabaseClient<Database>();
  const eventsClient = () => supabase as unknown as EventsClient;
  const concertsClient = () => supabase as unknown as ConcertsClient;

  const events = ref<EventRecord[]>([]);
  const concerts = ref<ConcertRecord[]>([]);
  const currentEvent = ref<EventRecord | null>(null);
  const currentConcerts = ref<ConcertRecord[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const concertsForEvent = (eventId: string) => {
    return concerts.value.filter(concert => concert.event_id === eventId);
  };

  const fetchEvents = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      loading.value = true;
    }
    error.value = null;

    try {
      const result = await listOwnedEvents(eventsClient());

      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      events.value = result.data ?? [];

      const listedConcerts = await listOwnedConcerts(concertsClient());
      if (listedConcerts.error) {
        error.value = listedConcerts.error.message;
        return { data: events.value, error: listedConcerts.error.message };
      }

      concerts.value = listedConcerts.data ?? [];

      return { data: events.value, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to load events');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      if (!options?.silent) {
        loading.value = false;
      }
    }
  };

  const fetchEvent = async (id: string) => {
    loading.value = true;
    error.value = null;
    currentEvent.value = null;
    currentConcerts.value = [];

    try {
      const result = await getOwnedEvent(eventsClient(), id);

      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      currentEvent.value = result.data;

      if (result.data) {
        const listed = await listConcertsForEvent(concertsClient(), id);
        if (listed.error) {
          error.value = listed.error.message;
          return { data: result.data, error: listed.error.message };
        }

        currentConcerts.value = listed.data ?? [];
      }

      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to load event');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const createOwnedEvent = async (input: CreateEventInput) => {
    loading.value = true;
    error.value = null;

    try {
      const result = await createEvent(eventsClient(), input);

      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      if (result.data) {
        const listed = await listOwnedEvents(eventsClient());
        if (!listed.error && listed.data) {
          events.value = listed.data;
        }
      }

      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to create event');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const createOwnedConcert = async (input: CreateConcertInput) => {
    loading.value = true;
    error.value = null;

    try {
      const result = await createConcert(concertsClient(), input);

      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      const listedEvents = await listOwnedEvents(eventsClient());
      if (listedEvents.error) {
        error.value = listedEvents.error.message;
        return { data: result.data, error: listedEvents.error.message };
      }

      events.value = listedEvents.data ?? [];

      const listedConcerts = await listOwnedConcerts(concertsClient());
      if (listedConcerts.error) {
        error.value = listedConcerts.error.message;
        return { data: result.data, error: listedConcerts.error.message };
      }

      concerts.value = listedConcerts.data ?? [];
      if (currentEvent.value) {
        currentConcerts.value = concerts.value.filter(
          concert => concert.event_id === currentEvent.value?.id
        );
      }

      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to create concert');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  return {
    events,
    concerts,
    currentEvent,
    currentConcerts,
    loading,
    error,
    concertsForEvent,
    fetchEvents,
    fetchEvent,
    createOwnedEvent,
    createOwnedConcert
  };
});
