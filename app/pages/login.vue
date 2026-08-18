<script setup lang="ts">
import { ref, watch } from 'vue';
import { navigateTo, useRoute, useRuntimeConfig, useSupabaseUser } from '#imports';
import { useAuthStore } from '@/stores/auth';
import { isValidUsername, USERNAME_CHARSET_ERROR } from '@/utils/username';
import { getSafeInternalPath } from '@/utils/safe-redirect';

const authStore = useAuthStore();
const route = useRoute();
const config = useRuntimeConfig();
const user = useSupabaseUser();

const email = ref('');
const password = ref('');
const username = ref('');
const mode = ref<'signin' | 'signup'>('signin');
const loading = ref(false);
const errorMessage = ref('');
const pendingRedirect = ref(false);

const getRedirectPath = (): string => getSafeInternalPath(route.query.redirect);

watch(user, (value) => {
  if (value && pendingRedirect.value) {
    pendingRedirect.value = false;
    navigateTo(getRedirectPath());
  } else if (value) {
    navigateTo(getRedirectPath());
  }
}, { immediate: true });

const toggleMode = () => {
  mode.value = mode.value === 'signin' ? 'signup' : 'signin';
  errorMessage.value = '';
};

async function submit() {
  if (loading.value) return;

  loading.value = true;
  errorMessage.value = '';

  try {
    if (mode.value === 'signup' && !isValidUsername(username.value)) {
      errorMessage.value = USERNAME_CHARSET_ERROR;
      return;
    }

    const result = mode.value === 'signin'
      ? await authStore.signIn(email.value, password.value)
      : await authStore.signUp(email.value, password.value, username.value);

    if (result.error) {
      errorMessage.value = result.error;
      return;
    }

    pendingRedirect.value = true;
    await navigateTo(getRedirectPath());
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UContainer class="py-16 max-w-md">
    <div class="space-y-6">
      <div class="space-y-2 text-center">
        <h1 class="text-2xl font-semibold text-highlighted">
          {{ mode === 'signin' ? 'Sign in' : 'Create account' }}
        </h1>
        <p class="text-muted">
          Access {{ config.public.appName }}.
        </p>
      </div>

      <form
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UFormField
          label="Email"
          name="email"
        >
          <UInput
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="mode === 'signup'"
          label="Username"
          name="username"
        >
          <UInput
            v-model="username"
            type="text"
            name="username"
            autocomplete="username"
            required
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Password"
          name="password"
        >
          <UInput
            v-model="password"
            type="password"
            name="password"
            :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
            required
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />

        <UButton
          type="submit"
          block
          size="lg"
          color="primary"
          variant="outline"
          class="h-11 rounded-full ring-2"
          :loading="loading"
          :label="mode === 'signin' ? 'Sign in' : 'Sign up'"
        />
      </form>

      <p class="text-center text-sm text-muted">
        <button
          type="button"
          class="text-primary underline-offset-4 hover:underline"
          @click="toggleMode"
        >
          {{ mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in' }}
        </button>
      </p>
    </div>
  </UContainer>
</template>
