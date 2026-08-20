import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabaseClient, useToast } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import { canWriteOnline, OFFLINE_TOAST_TITLE } from '@/utils/online-write';
import type { Database } from '@/types/database.types';
import {
  createPersonalKey as createPersonalKeyRecord,
  getPersonalKeyStatus,
  revokePersonalKey as revokePersonalKeyRecord,
  type PersonalKeysClient
} from '#shared/domain/personal-keys';

export const usePersonalKeysStore = defineStore('personalKeys', () => {
  const supabase = useSupabaseClient<Database>();
  const client = supabase as unknown as PersonalKeysClient;
  const toast = useToast();

  const hasKey = ref(false);
  const plaintext = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const offlineWriteError = () => {
    if (canWriteOnline()) {
      return null;
    }

    toast.add({ title: OFFLINE_TOAST_TITLE });
    return OFFLINE_TOAST_TITLE;
  };

  const requireUserId = async () => {
    const { data: session } = await supabase.auth.getUser();
    const userId = session.user?.id;
    if (!userId) {
      throw new Error('Profile not found');
    }

    return userId;
  };

  const fetchStatus = async () => {
    loading.value = true;
    error.value = null;

    try {
      const userId = await requireUserId();
      const result = await getPersonalKeyStatus(client, userId);
      if (result.error) {
        throw new Error(result.error.message);
      }

      hasKey.value = Boolean(result.data);
      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to load personal key');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const createKey = async () => {
    const offline = offlineWriteError();
    if (offline) {
      return { data: null, error: offline };
    }

    loading.value = true;
    error.value = null;

    try {
      const userId = await requireUserId();
      const result = await createPersonalKeyRecord(client, userId);
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? 'Failed to create personal key');
      }

      hasKey.value = true;
      plaintext.value = result.data.plaintext;
      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to create personal key');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const revokeKey = async () => {
    const offline = offlineWriteError();
    if (offline) {
      return { data: null, error: offline };
    }

    loading.value = true;
    error.value = null;

    try {
      const userId = await requireUserId();
      const result = await revokePersonalKeyRecord(client, userId);
      if (result.error) {
        throw new Error(result.error.message);
      }

      hasKey.value = false;
      plaintext.value = null;
      return { data: true, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to revoke personal key');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const dismissPlaintext = () => {
    plaintext.value = null;
  };

  return {
    hasKey,
    plaintext,
    loading,
    error,
    fetchStatus,
    createKey,
    revokeKey,
    dismissPlaintext
  };
});
