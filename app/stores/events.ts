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

export type { CreateEventInput, EventKind, EventRecord };

export const useEventsStore = defineStore('events', () => {
  const supabase = useSupabaseClient<Database>();
  const client = () => supabase as unknown as EventsClient;

  const events = ref<EventRecord[]>([]);
  const currentEvent = ref<EventRecord | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchEvents = async () => {
    loading.value = true;
    error.value = null;

    try {
      const result = await listOwnedEvents(client());

      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      events.value = result.data ?? [];
      return { data: events.value, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to load events');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const fetchEvent = async (id: string) => {
    loading.value = true;
    error.value = null;
    currentEvent.value = null;

    try {
      const result = await getOwnedEvent(client(), id);

      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      currentEvent.value = result.data;
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
      const result = await createEvent(client(), input);

      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      if (result.data) {
        const listed = await listOwnedEvents(client());
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

  return {
    events,
    currentEvent,
    loading,
    error,
    fetchEvents,
    fetchEvent,
    createOwnedEvent
  };
});
