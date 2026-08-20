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

type SharedListClient = {
  from: (relation: 'shared_list_profiles') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: SharedListProfile | null; error: QueryError | null }>;
      };
    };
  };
};

const trim = (value: string | undefined) => (value ?? '').trim();

const ok = <T>(data: T): SharedListResult<T> => ({ data, error: null });

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

  const { data, error } = await client
    .from('shared_list_profiles')
    .select('username')
    .eq('username_key', handle.toLowerCase())
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: {
        ruleId: 'shared_list_failed',
        message: error.message
      }
    };
  }

  if (!data?.username) {
    return ok(null);
  }

  return ok({ username: data.username });
};
