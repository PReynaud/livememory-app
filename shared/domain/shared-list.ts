export type SharedListProfile = {
  username: string;
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

export type SharedListClient = {
  rpc: (
    fn: 'get_shared_list_profile',
    args: { requested: string }
  ) => Promise<{ data: SharedListProfile[] | SharedListProfile | null; error: QueryError | null }>;
};

const trim = (value: string | undefined) => (value ?? '').trim();

const ok = <T>(data: T): SharedListResult<T> => ({ data, error: null });

const asRows = (
  data: SharedListProfile[] | SharedListProfile | null | undefined
): SharedListProfile[] => {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : [data];
};

export const SHARED_LIST_EMPTY = 'Nothing to show yet.';
export const SHARED_LIST_NOT_FOUND = 'Not found.';
export const SHARED_LIST_HELPER
  = 'Friends see Going and Attended. They can open an Event to join — they never edit your bill or see notes.';

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
    return {
      data: null,
      error: {
        ruleId: 'shared_list_failed',
        message: error.message
      }
    };
  }

  const row = asRows(data)[0];
  if (!row?.username) {
    return ok(null);
  }

  return ok({ username: row.username });
};
