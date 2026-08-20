<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { definePageMeta, useSupabaseUser, useToast } from '#imports';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';
import { COPY_LINK_FAILED, copyTextToClipboard } from '@/utils/copy-link';
import { SHARED_LIST_HELPER } from '#shared/domain/shared-list';

definePageMeta({
  middleware: 'auth'
});

const supabaseUser = useSupabaseUser();
const toast = useToast();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const { username, sharedListEnabled, error, loading } = storeToRefs(profileStore);
const copyBusy = ref(false);

const metadataUsername = computed(() => {
  const value = supabaseUser.value?.user_metadata?.username;
  return typeof value === 'string' && value.length > 0 ? value : '';
});

const shownUsername = computed(() => username.value || metadataUsername.value);

const sharedListUrl = computed(() => {
  if (!shownUsername.value || !import.meta.client) {
    return '';
  }

  return `${window.location.origin}/u/${shownUsername.value}`;
});

watch(() => supabaseUser.value?.id, () => {
  void profileStore.fetchOwnProfile();
}, { immediate: true });

const persistSharing = async (enabled: boolean) => {
  const previous = sharedListEnabled.value;
  sharedListEnabled.value = enabled;
  const result = await profileStore.setSharedListEnabled(enabled);
  if (result.error) {
    sharedListEnabled.value = previous;
  }
};

const copySharedListLink = async () => {
  if (copyBusy.value || !sharedListUrl.value) {
    return;
  }

  copyBusy.value = true;
  try {
    const result = await copyTextToClipboard(sharedListUrl.value);
    if (result.error) {
      toast.add({ title: COPY_LINK_FAILED });
    }
  } finally {
    copyBusy.value = false;
  }
};

const signOut = async () => {
  profileStore.setUsername(null);
  await authStore.signOut();
};
</script>

<template>
  <UContainer class="py-8 max-w-lg space-y-4">
    <h1 class="text-[34px] font-bold tracking-tight leading-tight">
      Profile
    </h1>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      data-testid="profile-error"
      :title="error"
    />

    <p
      v-if="shownUsername"
      class="text-lg font-semibold"
      data-testid="profile-username"
    >
      {{ shownUsername }}
    </p>
    <p
      v-else
      class="text-lg font-semibold text-muted"
      data-testid="profile-username"
    >
      …
    </p>

    <USwitch
      :model-value="sharedListEnabled"
      label="Shared list"
      :disabled="loading"
      data-testid="shared-list-toggle"
      @update:model-value="void persistSharing($event === true)"
    />

    <p class="text-[13px] text-muted">
      {{ SHARED_LIST_HELPER }}
    </p>

    <UButton
      v-if="sharedListEnabled"
      label="Copy link"
      color="primary"
      variant="outline"
      class="h-11 rounded-full ring-2"
      :loading="copyBusy"
      @click="void copySharedListLink()"
    />

    <UButton
      label="Sign out"
      color="neutral"
      variant="outline"
      class="h-11 rounded-full"
      @click="signOut()"
    />
  </UContainer>
</template>
