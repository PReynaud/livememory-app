import { fail, ok, type DomainResult } from './result';

export const PROFILE_RULE = {
  notFound: 'profile_not_found',
  persistFailed: 'persist_failed'
} as const;

export const PROFILE_RULE_MESSAGE = {
  notFound: 'Profile not found',
  persistFailed: 'Failed to load profile'
} as const;

export const PROFILE_COLUMNS = 'username, shared_list_enabled';

export type ProfileRecord = {
  username: string;
  shared_list_enabled: boolean;
};

type QueryError = {
  message: string;
};

type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
};

export type ProfilesClient = {
  from: (relation: 'profiles') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<QueryResult<ProfileRecord | null>>;
      };
    };
    update: (values: { shared_list_enabled: boolean }) => {
      eq: (column: string, value: string) => {
        select: (columns: string) => {
          single: () => Promise<QueryResult<ProfileRecord>>;
        };
      };
    };
  };
};

export const getOwnProfile = async (
  client: ProfilesClient,
  userId: string
): Promise<DomainResult<ProfileRecord>> => {
  if (!userId) {
    return fail(PROFILE_RULE.notFound, PROFILE_RULE_MESSAGE.notFound);
  }

  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return fail(PROFILE_RULE.persistFailed, error.message);
  }

  if (!data?.username) {
    return fail(PROFILE_RULE.notFound, PROFILE_RULE_MESSAGE.notFound);
  }

  return ok({
    username: data.username,
    shared_list_enabled: Boolean(data.shared_list_enabled)
  });
};

export const setSharedListEnabled = async (
  client: ProfilesClient,
  userId: string,
  enabled: boolean
): Promise<DomainResult<ProfileRecord>> => {
  if (!userId) {
    return fail(PROFILE_RULE.notFound, PROFILE_RULE_MESSAGE.notFound);
  }

  const { data, error } = await client
    .from('profiles')
    .update({ shared_list_enabled: enabled })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    return fail(PROFILE_RULE.persistFailed, error.message);
  }

  if (!data?.username) {
    return fail(PROFILE_RULE.notFound, PROFILE_RULE_MESSAGE.notFound);
  }

  return ok({
    username: data.username,
    shared_list_enabled: Boolean(data.shared_list_enabled)
  });
};
