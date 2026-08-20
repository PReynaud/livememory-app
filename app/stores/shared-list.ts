import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabaseClient } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import type { Database } from '@/types/database.types';
import {
  getSharedListConcerts,
  getSharedListProfile,
  type SharedListClient,
  type SharedListEventGroup,
  type SharedListProfile
} from '#shared/domain/shared-list';

export const useSharedListStore = defineStore('sharedList', () => {
  const supabase = useSupabaseClient<Database>();
  const sharedListClient = () => supabase as unknown as SharedListClient;

  const profile = ref<SharedListProfile | null>(null);
  const groups = ref<SharedListEventGroup[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchPublicProfile = async (username: string) => {
    loading.value = true;
    error.value = null;
    profile.value = null;
    groups.value = [];

    try {
      const result = await getSharedListProfile(sharedListClient(), username);
      if (result.error) {
        error.value = result.error.message;
        return { data: null, error: result.error.message };
      }

      profile.value = result.data;
      if (!result.data) {
        return { data: null, error: null };
      }

      const concerts = await getSharedListConcerts(sharedListClient(), result.data.username);
      if (concerts.error) {
        profile.value = null;
        error.value = concerts.error.message;
        return { data: null, error: concerts.error.message };
      }

      groups.value = concerts.data ?? [];
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
    groups,
    loading,
    error,
    fetchPublicProfile
  };
});
