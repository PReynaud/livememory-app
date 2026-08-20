import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabaseClient } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import type { Database } from '@/types/database.types';
import {
  getSharedListProfile,
  type SharedListProfile
} from '#shared/domain/shared-list';

export const useSharedListStore = defineStore('sharedList', () => {
  const supabase = useSupabaseClient<Database>();

  const profile = ref<SharedListProfile | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchPublicProfile = async (username: string) => {
    loading.value = true;
    error.value = null;
    profile.value = null;

    try {
      const result = await getSharedListProfile(supabase, username);
      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      profile.value = result.data;
      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to load shared list');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  return {
    profile,
    loading,
    error,
    fetchPublicProfile
  };
});
