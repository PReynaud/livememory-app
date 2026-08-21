export type PersonalKeyRecord = {
  id: string;
  user_id: string;
  created_at: string;
};

export type PersonalKeyError = {
  ruleId: string;
  message: string;
};

export type PersonalKeyResult<T> = {
  data: T | null;
  error: PersonalKeyError | null;
};

type QueryError = {
  message: string;
};

type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
};

export type PersonalKeysClient = {
  from: (relation: 'personal_keys') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<QueryResult<PersonalKeyRecord | null>>;
      };
    };
    insert: (values: { user_id: string; key_hash: string }) => {
      select: (columns: string) => {
        single: () => PromiseLike<QueryResult<PersonalKeyRecord>>;
      };
    };
    delete: () => {
      eq: (column: string, value: string) => PromiseLike<QueryResult<null>>;
    };
  };
};

export const PERSONAL_KEY_HELPER
  = 'Create a key so an agent can act as you. In Cursor MCP headers use Authorization = Bearer <key> (or paste the raw lm_ key). It is shown once. There is no expiry — revoke it if it leaks.';
export const PERSONAL_KEY_COPY_NOW = 'Copy this key now. You will not see it again.';
export const PERSONAL_KEY_ACTIVE = 'A personal key is active.';
export const COPY_KEY_FAILED = 'Couldn\'t copy the key.';
export const PERSONAL_KEY_COLUMNS = 'id, user_id, created_at';

const KEY_BYTES = 32;

const fail = (message: string): PersonalKeyResult<never> => ({
  data: null,
  error: {
    ruleId: 'personal_key_failed',
    message
  }
});

const ok = <T>(data: T): PersonalKeyResult<T> => ({ data, error: null });

const toHex = (bytes: Uint8Array) => {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

const toBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

export const generatePersonalKey = (): string => {
  const bytes = new Uint8Array(KEY_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return `lm_${toBase64Url(bytes)}`;
};

export const hashPersonalKey = async (plaintext: string): Promise<string> => {
  const bytes = new TextEncoder().encode(plaintext);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
};

export const getPersonalKeyStatus = async (
  client: PersonalKeysClient,
  userId: string
): Promise<PersonalKeyResult<PersonalKeyRecord | null>> => {
  if (!userId) {
    return fail('Profile not found');
  }

  const { data, error } = await client
    .from('personal_keys')
    .select(PERSONAL_KEY_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return fail(error.message);
  }

  return ok(data);
};

export const createPersonalKey = async (
  client: PersonalKeysClient,
  userId: string
): Promise<PersonalKeyResult<{ record: PersonalKeyRecord; plaintext: string }>> => {
  if (!userId) {
    return fail('Profile not found');
  }

  const plaintext = generatePersonalKey();
  const keyHash = await hashPersonalKey(plaintext);

  const removed = await client.from('personal_keys').delete().eq('user_id', userId);
  if (removed.error) {
    return fail(removed.error.message);
  }

  const inserted = await client
    .from('personal_keys')
    .insert({ user_id: userId, key_hash: keyHash })
    .select(PERSONAL_KEY_COLUMNS)
    .single();

  if (inserted.error || !inserted.data) {
    return fail(inserted.error?.message ?? 'Failed to create personal key');
  }

  return ok({ record: inserted.data, plaintext });
};

export const revokePersonalKey = async (
  client: PersonalKeysClient,
  userId: string
): Promise<PersonalKeyResult<true>> => {
  if (!userId) {
    return fail('Profile not found');
  }

  const { error } = await client.from('personal_keys').delete().eq('user_id', userId);
  if (error) {
    return fail(error.message);
  }

  return ok(true);
};
