import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useSupabaseClient } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import type { Database } from '@/types/database.types';
import {
  createEvent,
  getOwnedEvent,
  listEventStages,
  listOwnedEvents,
  listOwnedStages,
  selectFeaturedEvents,
  updateEvent,
  type CreateEventInput,
  type EventKind,
  type EventRecord,
  type EventStageRecord,
  type EventsClient,
  type UpdateEventInput
} from '#shared/domain/events';
import { souvenirStats } from '#shared/domain/home';
import {
  createConcert,
  deleteConcert,
  listConcertsForEvent,
  listOwnedConcerts,
  updateConcert,
  type ConcertCreateOutcome,
  type ConcertRecord,
  type ConcertsClient,
  type CreateConcertInput,
  type UpdateConcertInput
} from '#shared/domain/concerts';
import {
  clearAttendance,
  isConcertPast,
  listMyAttendance,
  setAttendance,
  type AttendanceClient,
  type AttendanceStatus
} from '#shared/domain/attendance';
import {
  currentConcertsForEvent,
  omitAttendanceForConcert,
  omitConcert,
  upsertConcert
} from '@/utils/concert-mutation-state';

export type { ConcertCreateOutcome, ConcertRecord, CreateConcertInput, CreateEventInput, EventKind, EventRecord, EventStageRecord, UpdateConcertInput, UpdateEventInput };
export type { AttendanceStatus };

type ConcertMutationResult = {
  data: ConcertRecord | null;
  error: string | null;
  outcome: ConcertCreateOutcome | null;
  ruleId: string | null;
};

const mutationResult = (
  data: ConcertRecord | null,
  error: string | null,
  outcome: ConcertCreateOutcome | null = null,
  ruleId: string | null = null
): ConcertMutationResult => ({
  data,
  error,
  outcome,
  ruleId
});

export const useEventsStore = defineStore('events', () => {
  const supabase = useSupabaseClient<Database>();
  const eventsClient = () => supabase as unknown as EventsClient;
  const concertsClient = () => supabase as unknown as ConcertsClient;
  const attendanceClient = () => supabase as unknown as AttendanceClient;

  const events = ref<EventRecord[]>([]);
  const concerts = ref<ConcertRecord[]>([]);
  const currentEvent = ref<EventRecord | null>(null);
  const currentConcerts = ref<ConcertRecord[]>([]);
  const currentStages = ref<EventStageRecord[]>([]);
  const stagesByEventId = ref<Record<string, EventStageRecord[]>>({});
  const attendanceByConcertId = ref<Record<string, AttendanceStatus>>({});
  const attendanceBusyByConcertId = ref<Record<string, true>>({});
  const attendanceError = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const mergeAttendance = (rows: { concert_id: string; status: AttendanceStatus }[]) => {
    const next: Record<string, AttendanceStatus> = {};
    for (const row of rows) {
      next[row.concert_id] = row.status;
    }
    attendanceByConcertId.value = next;
  };

  const loadAttendance = async () => {
    const listed = await listMyAttendance(attendanceClient());
    if (listed.error) {
      return listed.error.message;
    }

    mergeAttendance(listed.data ?? []);
    return null;
  };

  const attendanceStatus = (concertId: string): AttendanceStatus | null => {
    return attendanceByConcertId.value[concertId] ?? null;
  };

  const isAttendanceBusy = (concertId: string) => {
    return Boolean(attendanceBusyByConcertId.value[concertId]);
  };

  const concertIsPast = (concert: Pick<ConcertRecord, 'date' | 'time'>, now?: Date) => {
    return isConcertPast(concert, now);
  };

  const concertsForEvent = (eventId: string) => {
    return concerts.value.filter(concert => concert.event_id === eventId);
  };

  const stagesForEvent = (eventId: string) => {
    return stagesByEventId.value[eventId] ?? [];
  };

  const groupStages = (rows: EventStageRecord[]) => {
    const next: Record<string, EventStageRecord[]> = {};
    for (const stage of rows) {
      next[stage.event_id] = [...(next[stage.event_id] ?? []), stage];
    }
    stagesByEventId.value = next;
  };

  const featuredEvents = computed(() => selectFeaturedEvents(events.value));

  const homeStats = computed(() => souvenirStats({
    ownedEventCount: events.value.length,
    statuses: Object.values(attendanceByConcertId.value)
  }));

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

      const listedStages = await listOwnedStages(eventsClient());
      if (listedStages.error) {
        error.value = listedStages.error.message;
        return { data: events.value, error: listedStages.error.message };
      }

      groupStages(listedStages.data ?? []);

      const listedAttendanceError = await loadAttendance();
      attendanceError.value = listedAttendanceError;
      if (listedAttendanceError) {
        error.value = listedAttendanceError;
        return { data: events.value, error: listedAttendanceError };
      }

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
    currentStages.value = [];

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

        const stages = await listEventStages(eventsClient(), id);
        if (stages.error) {
          error.value = stages.error.message;
          return { data: result.data, error: stages.error.message };
        }

        currentStages.value = stages.data ?? [];
        stagesByEventId.value = {
          ...stagesByEventId.value,
          [id]: currentStages.value
        };
      }

      const listedAttendanceError = await loadAttendance();
      attendanceError.value = listedAttendanceError;

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

  const updateOwnedEvent = async (input: UpdateEventInput) => {
    loading.value = true;
    error.value = null;

    try {
      const result = await updateEvent(eventsClient(), input);

      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message, conflicts: result.error.conflicts ?? null };
      }

      if (result.data) {
        const listed = await listOwnedEvents(eventsClient());
        if (!listed.error && listed.data) {
          events.value = listed.data;
        }

        currentEvent.value = result.data;
        const stages = await listEventStages(eventsClient(), result.data.id);
        if (!stages.error) {
          currentStages.value = stages.data ?? [];
          stagesByEventId.value = {
            ...stagesByEventId.value,
            [result.data.id]: currentStages.value
          };
        }

        const listedConcerts = await listConcertsForEvent(concertsClient(), result.data.id);
        if (!listedConcerts.error) {
          currentConcerts.value = listedConcerts.data ?? [];
        }
      }

      return { data: result.data, error: null, conflicts: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to update event');
      error.value = errorMessage;
      return { data: null, error: errorMessage, conflicts: null };
    } finally {
      loading.value = false;
    }
  };

  const reloadOwnedConcertState = async () => {
    const listedEvents = await listOwnedEvents(eventsClient());
    if (listedEvents.error) {
      error.value = listedEvents.error.message;
      return listedEvents.error.message;
    }

    events.value = listedEvents.data ?? [];

    const listedConcerts = await listOwnedConcerts(concertsClient());
    if (listedConcerts.error) {
      error.value = listedConcerts.error.message;
      return listedConcerts.error.message;
    }

    concerts.value = listedConcerts.data ?? [];
    const listedCurrent = currentConcertsForEvent(concerts.value, currentEvent.value?.id);
    if (listedCurrent) {
      currentConcerts.value = listedCurrent;
    }

    const listedStages = await listOwnedStages(eventsClient());
    if (!listedStages.error) {
      groupStages(listedStages.data ?? []);
      if (currentEvent.value) {
        currentStages.value = stagesByEventId.value[currentEvent.value.id] ?? [];
      }
    }

    const listedAttendanceError = await loadAttendance();
    attendanceError.value = listedAttendanceError;
    if (listedAttendanceError) {
      error.value = listedAttendanceError;
      return listedAttendanceError;
    }

    return null;
  };

  const refreshConcertLists = async (resultData: ConcertRecord | null, outcome: ConcertCreateOutcome | null) => {
    const refreshError = await reloadOwnedConcertState();
    if (refreshError) {
      return mutationResult(resultData, refreshError, outcome, null);
    }

    return mutationResult(resultData, null, outcome, null);
  };

  const applyOwnedConcert = (concert: ConcertRecord) => {
    concerts.value = upsertConcert(concerts.value, concert);
    const listedCurrent = currentConcertsForEvent(concerts.value, currentEvent.value?.id);
    if (listedCurrent) {
      currentConcerts.value = listedCurrent;
    }
  };

  const dropOwnedConcert = (concertId: string) => {
    concerts.value = omitConcert(concerts.value, concertId);
    attendanceByConcertId.value = omitAttendanceForConcert(attendanceByConcertId.value, concertId);
    const listedCurrent = currentConcertsForEvent(concerts.value, currentEvent.value?.id);
    if (listedCurrent) {
      currentConcerts.value = listedCurrent;
    }
  };

  const createOwnedConcert = async (input: CreateConcertInput) => {
    loading.value = true;
    error.value = null;

    try {
      const result = await createConcert(concertsClient(), input);

      if (result.outcome === 'needs_choice' || result.outcome === 'impossible_place') {
        return mutationResult(
          result.data,
          result.error?.message ?? null,
          result.outcome,
          result.error?.ruleId ?? result.outcome
        );
      }

      if (result.error) {
        error.value = result.error.message;
        return mutationResult(null, result.error.message, result.outcome, result.error.ruleId);
      }

      return await refreshConcertLists(result.data, result.outcome);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to create concert');
      error.value = errorMessage;
      return mutationResult(null, errorMessage);
    } finally {
      loading.value = false;
    }
  };

  const updateOwnedConcert = async (input: UpdateConcertInput) => {
    loading.value = true;
    error.value = null;

    try {
      const result = await updateConcert(concertsClient(), input);

      if (result.outcome === 'needs_choice' || result.outcome === 'impossible_place') {
        return mutationResult(
          result.data,
          result.error?.message ?? null,
          result.outcome,
          result.error?.ruleId ?? result.outcome
        );
      }

      if (result.error) {
        error.value = result.error.message;
        return mutationResult(null, result.error.message, result.outcome, result.error.ruleId);
      }

      if (result.data) {
        applyOwnedConcert(result.data);
      }

      await reloadOwnedConcertState();
      return mutationResult(result.data, null, result.outcome, null);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to update concert');
      error.value = errorMessage;
      return mutationResult(null, errorMessage);
    } finally {
      loading.value = false;
    }
  };

  const deleteOwnedConcert = async (concertId: string) => {
    loading.value = true;
    error.value = null;

    try {
      const result = await deleteConcert(concertsClient(), concertId);

      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      dropOwnedConcert(concertId);
      await reloadOwnedConcertState();
      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to delete concert');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const cycleAttendance = async (concert: ConcertRecord) => {
    if (attendanceBusyByConcertId.value[concert.id]) {
      return { data: null, error: null };
    }

    attendanceBusyByConcertId.value = {
      ...attendanceBusyByConcertId.value,
      [concert.id]: true
    };
    attendanceError.value = null;

    try {
      const current = attendanceStatus(concert.id);
      const result = current
        ? await clearAttendance(attendanceClient(), concert.id)
        : await setAttendance(attendanceClient(), {
            concertId: concert.id,
            status: isConcertPast(concert) ? 'attended' : 'going'
          });

      if (result.error) {
        attendanceError.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      if (current) {
        attendanceByConcertId.value = Object.fromEntries(
          Object.entries(attendanceByConcertId.value).filter(([concertId]) => concertId !== concert.id)
        );
      } else if (result.data) {
        attendanceByConcertId.value = {
          ...attendanceByConcertId.value,
          [concert.id]: result.data.status
        };
      }

      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to update attendance');
      attendanceError.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      attendanceBusyByConcertId.value = Object.fromEntries(
        Object.entries(attendanceBusyByConcertId.value).filter(([concertId]) => concertId !== concert.id)
      ) as Record<string, true>;
    }
  };

  return {
    events,
    concerts,
    currentEvent,
    currentConcerts,
    currentStages,
    stagesByEventId,
    attendanceByConcertId,
    attendanceError,
    loading,
    error,
    concertsForEvent,
    stagesForEvent,
    featuredEvents,
    homeStats,
    attendanceStatus,
    isAttendanceBusy,
    concertIsPast,
    fetchEvents,
    fetchEvent,
    createOwnedEvent,
    updateOwnedEvent,
    createOwnedConcert,
    updateOwnedConcert,
    deleteOwnedConcert,
    cycleAttendance
  };
});
