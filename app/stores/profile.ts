import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabaseClient, useToast } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import { notifyOfflineWrite } from '@/utils/online-write';
import type { Database } from '@/types/database.types';
import {
  getOwnProfile,
  setSharedListEnabled as persistSharedListEnabled,
  type ProfilesClient
} from '#shared/domain/profiles';

export const useProfileStore = defineStore('profile', () => {
  const supabase = useSupabaseClient<Database>();
  const toast = useToast();
  const profilesClient = () => supabase as unknown as ProfilesClient;

  const username = ref<string | null>(null);
  const sharedListEnabled = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const setUsername = (value: string | null) => {
    username.value = value;
  };

  const applyProfile = (data: { username: string; shared_list_enabled: boolean }) => {
    username.value = data.username;
    sharedListEnabled.value = Boolean(data.shared_list_enabled);
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

      const result = await getOwnProfile(profilesClient(), userId);
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? 'Failed to load profile');
      }

      applyProfile(result.data);
      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to load profile');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const setSharedListEnabled = async (enabled: boolean) => {
    const offline = notifyOfflineWrite(toast);
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

      const result = await persistSharedListEnabled(profilesClient(), userId, enabled);
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? 'Failed to update sharing');
      }

      applyProfile(result.data);
      return { data: result.data, error: null };
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
