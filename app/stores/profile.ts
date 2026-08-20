import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabaseClient, useToast } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import { canWriteOnline, OFFLINE_TOAST_TITLE } from '@/utils/online-write';
import type { Database } from '@/types/database.types';

export const useProfileStore = defineStore('profile', () => {
  const supabase = useSupabaseClient<Database>();
  const toast = useToast();

  const username = ref<string | null>(null);
  const sharedListEnabled = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const setUsername = (value: string | null) => {
    username.value = value;
  };

  const offlineWriteError = () => {
    if (canWriteOnline()) {
      return null;
    }

    toast.add({ title: OFFLINE_TOAST_TITLE });
    return OFFLINE_TOAST_TITLE;
  };

  const fetchOwnProfile = async () => {
    loading.value = true;
    error.value = null;

    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) {
        throw new Error('Profile not found');
      }

      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('username, shared_list_enabled')
        .eq('id', userId)
        .maybeSingle();

      if (queryError) {
        throw new Error(queryError.message);
      }

      if (!data?.username) {
        throw new Error('Profile not found');
      }

      username.value = data.username;
      sharedListEnabled.value = Boolean(data.shared_list_enabled);
      return { data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to load profile');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const setSharedListEnabled = async (enabled: boolean) => {
    const offline = offlineWriteError();
    if (offline) {
      return { data: null, error: offline };
    }

    loading.value = true;
    error.value = null;

    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) {
        throw new Error('Profile not found');
      }

      const { data, error: queryError } = await supabase
        .from('profiles')
        .update({ shared_list_enabled: enabled })
        .eq('id', userId)
        .select('username, shared_list_enabled')
        .single();

      if (queryError) {
        throw new Error(queryError.message);
      }

      username.value = data.username;
      sharedListEnabled.value = Boolean(data.shared_list_enabled);
      return { data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to update sharing');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  return {
    username,
    sharedListEnabled,
    loading,
    error,
    setUsername,
    fetchOwnProfile,
    setSharedListEnabled
  };
});
