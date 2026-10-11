<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { definePageMeta, useRoute, useSupabaseUser } from '#imports';
import { isAllowedRedirectUri } from '#shared/domain/oauth-redirect';
import { useOauthGrantsStore } from '@/stores/oauth-grants';

definePageMeta({
  middleware: 'auth'
});

const route = useRoute();
const supabaseUser = useSupabaseUser();
const oauthGrantsStore = useOauthGrantsStore();
const { clientName, error, loading } = storeToRefs(oauthGrantsStore);
const submitting = ref(false);

const queryValue = (name: string) => {
  const value = route.query[name];
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : '';
};

const clientId = computed(() => queryValue('client_id'));
const redirectUri = computed(() => queryValue('redirect_uri'));
const redirectIsSafe = computed(() => isAllowedRedirectUri(redirectUri.value));

watch(() => [supabaseUser.value?.id, clientId.value] as const, () => {
  void oauthGrantsStore.fetchClient(clientId.value);
}, { immediate: true });

const submit = async (decision: 'allow' | 'deny') => {
  if (submitting.value || loading.value) {
    return;
  }

  if (decision === 'deny' && !redirectIsSafe.value) {
    return;
  }

  submitting.value = true;
  try {
    const result = await oauthGrantsStore.submitDecision({
      decision,
      clientId: clientId.value,
      redirectUri: queryValue('redirect_uri'),
      responseType: queryValue('response_type'),
      codeChallenge: queryValue('code_challenge'),
      codeChallengeMethod: queryValue('code_challenge_method'),
      state: queryValue('state'),
      resource: queryValue('resource')
    });
    if (result.data?.redirect) {
      window.location.assign(result.data.redirect);
    }
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <UContainer class="py-8 max-w-md space-y-4">
    <h1 class="text-[34px] font-bold tracking-tight leading-tight">
      Allow access
    </h1>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      data-testid="oauth-error"
      :title="error"
    />

    <p
      v-if="clientName"
      class="text-lg font-semibold"
      data-testid="oauth-client-name"
    >
      {{ clientName.clientName }}
    </p>
    <p
      v-else-if="loading"
      class="text-lg font-semibold text-muted"
      data-testid="oauth-client-name"
    >
      …
    </p>

    <p class="text-[13px] text-muted">
      Allowing this client lets it use your LiveMemory account until you revoke it on Profile.
    </p>

    <UButton
      label="Allow"
      color="primary"
      class="h-11 rounded-full"
      :loading="submitting"
      :disabled="submitting || loading || !clientName"
      data-testid="oauth-allow"
      @click="void submit('allow')"
    />

    <UButton
      label="Deny"
      color="neutral"
      variant="outline"
      class="h-11 rounded-full"
      :disabled="submitting || loading || !clientName || !redirectIsSafe"
      data-testid="oauth-deny"
      @click="void submit('deny')"
    />
  </UContainer>
</template>
