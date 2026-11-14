<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { definePageMeta, useSupabaseUser, useToast } from '#imports';
import { useAuthStore } from '@/stores/auth';
import { useOauthGrantsStore } from '@/stores/oauth-grants';
import { useProfileStore } from '@/stores/profile';
import { useAgentChatStore } from '@/stores/agent-chat';
import { COPY_LINK_FAILED, copyTextToClipboard } from '@/utils/copy-link';
import {
  OAUTH_GRANT_ACCESS,
  OAUTH_GRANT_REVOKE_HELPER,
  OAUTH_GRANTS_EMPTY,
  OAUTH_GRANTS_HELPER,
  formatGrantConnectedOn
} from '#shared/domain/oauth-grants';
import { SHARED_LIST_HELPER } from '#shared/domain/shared-list';

definePageMeta({
  middleware: 'auth'
});

const supabaseUser = useSupabaseUser();
const toast = useToast();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const oauthGrantsStore = useOauthGrantsStore();
const agentChat = useAgentChatStore();
const { username, sharedListEnabled, error, loading } = storeToRefs(profileStore);
const {
  grants,
  error: grantsError,
  loading: grantsLoading
} = storeToRefs(oauthGrantsStore);
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
  void oauthGrantsStore.fetchGrants();
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

const revokeGrant = async (grantId: string) => {
  await oauthGrantsStore.revokeGrant(grantId);
};

const signOut = async () => {
  profileStore.setUsername(null);
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

    <section
      class="lm-card p-5 space-y-4"
      aria-labelledby="profile-account-heading"
      data-testid="profile-account"
    >
      <header class="space-y-1">
        <h2
          id="profile-account-heading"
          class="text-xl font-semibold"
        >
          Account
        </h2>
        <p class="text-[13px] text-muted">
          Your username is the end of your shared list link. Signing out keeps everything in your journal.
        </p>
      </header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Username
          </p>
          <p
            v-if="shownUsername"
            class="text-lg font-semibold [overflow-wrap:anywhere]"
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
        </div>
        <UButton
          label="Sign out"
          color="neutral"
          variant="outline"
          class="h-11 rounded-full"
          @click="signOut()"
        />
      </div>
    </section>

    <section
      class="lm-card p-5 space-y-4"
      aria-labelledby="profile-sharing-heading"
      data-testid="profile-sharing"
    >
      <header class="space-y-1">
        <h2
          id="profile-sharing-heading"
          class="text-xl font-semibold"
        >
          Share with friends
        </h2>
        <p class="text-[13px] text-muted">
          {{ SHARED_LIST_HELPER }}
        </p>
      </header>
      <USwitch
        :model-value="sharedListEnabled"
        label="Shared list"
        :description="sharedListEnabled ? 'Anyone with the link can see your list.' : 'Your list is private.'"
        :disabled="loading"
        data-testid="shared-list-toggle"
        @update:model-value="void persistSharing($event === true)"
      />
      <div
        v-if="sharedListEnabled"
        class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--well)] px-4 py-3"
      >
        <p
          v-if="sharedListUrl"
          class="min-w-0 text-[13px] text-muted [overflow-wrap:anywhere]"
          data-testid="shared-list-url"
        >
          {{ sharedListUrl }}
        </p>
        <UButton
          label="Copy link"
          color="primary"
          variant="outline"
          class="h-11 rounded-full ring-2"
          :loading="copyBusy"
          @click="void copySharedListLink()"
        />
      </div>
    </section>

    <section
      class="lm-card p-5 space-y-4"
      aria-labelledby="profile-clients-heading"
      data-testid="profile-clients"
    >
      <header class="space-y-1">
        <h2
          id="profile-clients-heading"
          class="text-xl font-semibold"
        >
          Connected clients
        </h2>
        <p class="text-[13px] text-muted">
          {{ OAUTH_GRANTS_HELPER }}
        </p>
      </header>

      <UAlert
        v-if="grantsError"
        color="error"
        variant="subtle"
        data-testid="oauth-grants-error"
        :title="grantsError"
      />

      <p
        v-if="!grantsLoading && !grantsError && grants.length === 0"
        class="text-[15px] text-muted"
        data-testid="oauth-grants-empty"
      >
        {{ OAUTH_GRANTS_EMPTY }}
      </p>

      <template v-else-if="grants.length > 0">
        <ul
          class="divide-y divide-[var(--hairline)] rounded-2xl border border-[var(--border)] bg-[var(--well)]"
          aria-label="Connected clients"
        >
          <li
            v-for="grant in grants"
            :key="grant.id"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            data-testid="oauth-grant"
          >
            <div class="min-w-0 flex-1 space-y-0.5">
              <p
                class="text-base font-semibold [overflow-wrap:anywhere]"
                data-testid="oauth-grant-name"
              >
                {{ grant.clientName }}
              </p>
              <p class="text-[13px] text-muted">
                {{ OAUTH_GRANT_ACCESS }}
              </p>
              <p
                v-if="formatGrantConnectedOn(grant.createdAt)"
                class="text-[13px] text-muted"
                data-testid="oauth-grant-connected-on"
              >
                Connected {{ formatGrantConnectedOn(grant.createdAt) }}
              </p>
            </div>
            <UButton
              label="Revoke"
              :aria-label="`Revoke ${grant.clientName}`"
              color="neutral"
              variant="outline"
              class="h-11 rounded-full"
              :loading="grantsLoading"
              :disabled="grantsLoading"
              data-testid="oauth-grant-revoke"
              @click="void revokeGrant(grant.id)"
            />
          </li>
        </ul>
        <p
          class="text-[13px] text-muted"
          data-testid="oauth-grant-revoke-helper"
        >
          {{ OAUTH_GRANT_REVOKE_HELPER }}
        </p>
      </template>
    </section>

    <section
      class="lm-card p-5 space-y-4"
      aria-labelledby="profile-assistant-heading"
      data-testid="profile-assistant"
    >
      <header class="space-y-1">
        <h2
          id="profile-assistant-heading"
          class="text-xl font-semibold"
        >
          Cursor assistant
        </h2>
        <p class="text-[13px] text-muted">
          Connect a Cursor API key to open the assistant from the menu. It can add Events and Concerts for you and asks before it saves. Your key stays server-side.
        </p>
      </header>
      <UAlert
        v-if="agentChat.error"
        color="error"
        variant="subtle"
        :title="agentChat.error"
      />
      <div
        v-if="agentChat.connected"
        class="flex flex-wrap items-center justify-between gap-3"
      >
        <p
          v-if="agentChat.isReady"
          class="flex items-center gap-2 text-[15px]"
          data-testid="agent-connection-status"
        >
          <UIcon
            name="i-lucide-circle-check"
            class="size-4 shrink-0 text-[var(--focus)]"
            aria-hidden="true"
          />
          Cursor is connected.
        </p>
        <p
          v-else
          class="text-[15px] text-muted"
          data-testid="agent-connection-unhealthy"
        >
          Cursor is connected but not responding. Enter a new key below, or disconnect.
        </p>
        <UButton
          label="Disconnect Cursor"
          color="neutral"
          variant="outline"
          class="h-11 rounded-full"
          :loading="agentChat.loading"
          data-testid="agent-connection-disconnect"
          @click="void agentChat.disconnect()"
        />
      </div>
      <form
        v-if="!agentChat.isReady"
        class="flex items-center gap-3"
        @submit.prevent="void connectCursor()"
      >
        <UInput
          v-model="cursorKey"
          type="password"
          autocomplete="off"
          placeholder="Cursor API key"
          aria-label="Cursor API key"
          class="min-w-0 flex-1"
          data-testid="agent-connection-key"
        />
        <UButton
          type="submit"
          label="Connect Cursor"
          color="primary"
          variant="outline"
          class="h-11 shrink-0 rounded-full"
          :loading="agentChat.loading"
          :disabled="!cursorKey.trim() || agentChat.loading"
          data-testid="agent-connection-connect"
        />
      </form>
    </section>
  </UContainer>
</template>
