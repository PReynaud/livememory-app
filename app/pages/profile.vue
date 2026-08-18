<script setup lang="ts">
import { computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { definePageMeta, useSupabaseUser } from '#imports';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

definePageMeta({
  middleware: 'auth'
});

const supabaseUser = useSupabaseUser();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const { username, error } = storeToRefs(profileStore);

const metadataUsername = computed(() => {
  const value = supabaseUser.value?.user_metadata?.username;
  return typeof value === 'string' && value.length > 0 ? value : '';
});

const shownUsername = computed(() => username.value || metadataUsername.value);

watch(() => supabaseUser.value?.id, (userId) => {
  if (userId) {
    void profileStore.fetchOwnProfile(userId);
  }
}, { immediate: true });

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

    <UButton
      label="Sign out"
      color="neutral"
      variant="outline"
      class="h-11 rounded-full"
      @click="signOut()"
    />
  </UContainer>
</template>
