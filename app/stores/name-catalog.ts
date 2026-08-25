import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabaseClient } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import type { Database } from '@/types/database.types';
import {
  searchCatalogNames,
  type CatalogClient,
  type CatalogKind
} from '#shared/domain/catalog';

export const useNameCatalogStore = defineStore('nameCatalog', () => {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const catalogClient = (): CatalogClient => {
    return useSupabaseClient<Database>() as unknown as CatalogClient;
  };

  const searchNames = async (kind: CatalogKind, query: string) => {
    loading.value = true;
    error.value = null;

    try {
      const result = await searchCatalogNames(catalogClient(), kind, query);
      if (result.error) {
        error.value = result.error;
        return { data: [] as string[], error: result.error };
      }

      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to search names');
      error.value = errorMessage;
      return { data: [] as string[], error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    searchNames
  };
});
