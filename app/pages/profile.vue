<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { definePageMeta, useSupabaseUser, useToast } from '#imports';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';
import { usePersonalKeysStore } from '@/stores/personal-keys';
import { useAgentChatStore } from '@/stores/agent-chat';
import { COPY_LINK_FAILED, copyTextToClipboard } from '@/utils/copy-link';
import { SHARED_LIST_HELPER } from '#shared/domain/shared-list';
import {
  COPY_KEY_FAILED,
  PERSONAL_KEY_ACTIVE,
  PERSONAL_KEY_COPY_NOW,
  PERSONAL_KEY_HELPER
} from '#shared/domain/personal-keys';

definePageMeta({
  middleware: 'auth'
});

const supabaseUser = useSupabaseUser();
const toast = useToast();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const personalKeysStore = usePersonalKeysStore();
const agentChat = useAgentChatStore();
const { username, sharedListEnabled, error, loading } = storeToRefs(profileStore);
const {
  hasKey,
  plaintext,
  error: personalKeyError,
  loading: personalKeyLoading
} = storeToRefs(personalKeysStore);
const copyBusy = ref(false);
const copyKeyBusy = ref(false);

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
  void personalKeysStore.fetchStatus();
  void agentChat.fetchStatus();
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

const copyPersonalKey = async () => {
  if (copyKeyBusy.value || !plaintext.value) {
    return;
  }

  copyKeyBusy.value = true;
  try {
    const result = await copyTextToClipboard(plaintext.value);
    if (result.error) {
      toast.add({ title: COPY_KEY_FAILED });
    }
  } finally {
    copyKeyBusy.value = false;
  }
};

const signOut = async () => {
  profileStore.setUsername(null);
  personalKeysStore.dismissPlaintext();
  await authStore.signOut();
};

const cursorKey = ref('');
const connectCursor = async () => {
  const result = await agentChat.connect(cursorKey.value);
  if (!result.error) cursorKey.value = '';
};
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-4">
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

    <UAlert
      v-if="personalKeyError"
      color="error"
      variant="subtle"
      data-testid="personal-key-error"
      :title="personalKeyError"
    />

    <h2 class="text-xl font-semibold pt-2">
      Personal key
    </h2>

    <p class="text-[13px] text-muted">
      {{ PERSONAL_KEY_HELPER }}
    </p>

    <p
      v-if="hasKey && !plaintext"
      data-testid="personal-key-status"
    >
      {{ PERSONAL_KEY_ACTIVE }}
    </p>

    <div
      v-if="plaintext"
      class="space-y-3"
    >
      <p class="text-[13px] text-muted">
        {{ PERSONAL_KEY_COPY_NOW }}
      </p>
      <p
        class="break-all font-mono text-sm"
        data-testid="personal-key-plaintext"
      >
        {{ plaintext }}
      </p>
      <UButton
        label="Copy key"
        color="primary"
        variant="outline"
        class="h-11 rounded-full ring-2"
        :loading="copyKeyBusy"
        data-testid="personal-key-copy"
        @click="void copyPersonalKey()"
      />
      <UButton
        label="Done"
        color="neutral"
        variant="outline"
        class="h-11 rounded-full"
        data-testid="personal-key-dismiss"
        @click="personalKeysStore.dismissPlaintext()"
      />
    </div>

    <UButton
      :label="hasKey ? 'Create new key' : 'Create personal key'"
      color="primary"
      variant="outline"
      class="h-11 rounded-full"
      :loading="personalKeyLoading"
      :disabled="personalKeyLoading"
      data-testid="personal-key-create"
      @click="void personalKeysStore.createKey()"
    />

    <UButton
      v-if="hasKey"
      label="Revoke key"
      color="neutral"
      variant="outline"
      class="h-11 rounded-full"
      :loading="personalKeyLoading"
      :disabled="personalKeyLoading"
      data-testid="personal-key-revoke"
      @click="void personalKeysStore.revokeKey()"
    />

    <h2 class="text-xl font-semibold pt-2">
      Cursor assistant
    </h2>
    <p class="text-[13px] text-muted">
      Connect a Cursor API key to use the in-app assistant. Your key stays server-side.
    </p>
    <UAlert
      v-if="agentChat.error"
      color="error"
      variant="subtle"
      :title="agentChat.error"
    />
    <p
      v-if="agentChat.isReady"
      data-testid="agent-connection-status"
    >
      Cursor is connected.
    </p>
    <form
      v-else
      class="flex items-center gap-3"
      @submit.prevent="void connectCursor()"
    >
      <UInput
        v-model="cursorKey"
        type="password"
        autocomplete="off"
        placeholder="Cursor API key"
        class="min-w-0 flex-1"
        data-testid="agent-connection-key"
      />
      <UButton
        type="submit"
        label="Connect Cursor"
        class="shrink-0"
        :loading="agentChat.loading"
        :disabled="!cursorKey.trim() || agentChat.loading"
        data-testid="agent-connection-connect"
      />
    </form>
    <UButton
      v-if="agentChat.connected"
      label="Disconnect Cursor"
      color="neutral"
      variant="outline"
      :loading="agentChat.loading"
      data-testid="agent-connection-disconnect"
      @click="void agentChat.disconnect()"
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
