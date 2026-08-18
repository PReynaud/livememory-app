import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabaseClient } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import type { Database } from '@/types/database.types';

export const useProfileStore = defineStore('profile', () => {
  const supabase = useSupabaseClient<Database>();

  const username = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const setUsername = (value: string | null) => {
    username.value = value;
  };

  const fetchOwnProfile = async (userId: string) => {
    loading.value = true;
    error.value = null;

    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();

      if (queryError) {
        throw new Error(queryError.message);
      }

      if (!data?.username) {
        throw new Error('Profile not found');
      }

      username.value = data.username;
      return { data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to load profile');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  return {
    username,
    loading,
    error,
    setUsername,
    fetchOwnProfile
  };
});
