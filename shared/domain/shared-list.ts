import type { ConcertRecord } from './concerts';
import type { EventKind, EventRecord } from './events';

export type SharedListProfile = {
  username: string;
};

export type SharedListConcertRow = {
  event_id: string;
  event_name: string;
  event_kind: string;
  start_date: string;
  end_date: string;
  event_place: string;
  concert_id: string;
  artist: string;
  concert_date: string;
  concert_time: string | null;
  concert_place: string;
  stage_id: string | null;
  stage_name: string | null;
};

export type SharedListEventGroup = {
  event: EventRecord;
  concerts: ConcertRecord[];
};

export type SharedListError = {
  ruleId: string;
  message: string;
};

export type SharedListResult<T> = {
  data: T | null;
  error: SharedListError | null;
};

type QueryError = {
  message: string;
};

type SharedListRpcData
  = SharedListProfile[]
    | SharedListProfile
    | SharedListConcertRow[]
    | SharedListConcertRow
    | null;

export type SharedListClient = {
  rpc: (
    fn: 'get_shared_list_profile' | 'get_shared_list_concerts',
    args: { requested: string }
  ) => Promise<{ data: SharedListRpcData; error: QueryError | null }>;
};

const trim = (value: string | undefined) => (value ?? '').trim();

const ok = <T>(data: T): SharedListResult<T> => ({ data, error: null });

const fail = (message: string): SharedListResult<never> => ({
  data: null,
  error: {
    ruleId: 'shared_list_failed',
    message
  }
});

const asRows = <T extends object>(data: T[] | T | null | undefined): T[] => {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : [data];
};

const asEventKind = (value: string): EventKind => {
  return value === 'festival' ? 'festival' : 'single_night';
};

export const SHARED_LIST_EMPTY = 'Nothing to show yet.';
export const SHARED_LIST_NOT_FOUND = 'Not found.';
export const SHARED_LIST_HELPER
  = 'Friends see Going and Attended. They can open an Event to join — they never edit your bill or see notes.';

export const groupSharedListEvents = (rows: SharedListConcertRow[]): SharedListEventGroup[] => {
  const groups: SharedListEventGroup[] = [];
  const byEvent = new Map<string, SharedListEventGroup>();

  for (const row of rows) {
    let group = byEvent.get(row.event_id);
    if (!group) {
      group = {
        event: {
          id: row.event_id,
          owner_id: '',
          kind: asEventKind(row.event_kind),
          name: row.event_name,
          start_date: row.start_date,
          end_date: row.end_date,
          place: row.event_place
        },
        concerts: []
      };
      byEvent.set(row.event_id, group);
      groups.push(group);
    }

    group.concerts.push({
      id: row.concert_id,
      event_id: row.event_id,
      owner_id: '',
      artist: row.artist,
      date: row.concert_date,
      time: row.concert_time,
      place: row.concert_place,
      stage_id: row.stage_id,
      stage_name: row.stage_name
    });
  }

  return groups;
};

export const getSharedListProfile = async (
  client: SharedListClient,
  username: string
): Promise<SharedListResult<SharedListProfile | null>> => {
  const handle = trim(username);
  if (!handle) {
    return ok(null);
  }

  const { data, error } = await client.rpc('get_shared_list_profile', {
    requested: handle
  });

  if (error) {
    return fail(error.message);
  }

  const row = asRows(data as SharedListProfile[] | SharedListProfile | null)[0];
  if (!row || !('username' in row) || !row.username) {
    return ok(null);
  }

  return ok({ username: row.username });
};

export const getSharedListConcerts = async (
  client: SharedListClient,
  username: string
): Promise<SharedListResult<SharedListEventGroup[]>> => {
  const handle = trim(username);
  if (!handle) {
    return ok([]);
  }

  const { data, error } = await client.rpc('get_shared_list_concerts', {
    requested: handle
  });

  if (error) {
    return fail(error.message);
  }

  const rows = asRows(data as SharedListConcertRow[] | SharedListConcertRow | null)
    .filter((row): row is SharedListConcertRow => Boolean(row && 'concert_id' in row && row.concert_id));

  return ok(groupSharedListEvents(rows));
};
