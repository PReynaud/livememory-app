<script setup lang="ts">
import { ref, watch } from 'vue';
import { navigateTo, useRoute, useRuntimeConfig, useSupabaseUser } from '#imports';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const route = useRoute();
const config = useRuntimeConfig();
const user = useSupabaseUser();

const email = ref('');
const password = ref('');
const mode = ref<'signin' | 'signup'>('signin');
const loading = ref(false);
const errorMessage = ref('');
const pendingRedirect = ref(false);

const getRedirectPath = (): string => {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }

  return '/home';
};

watch(user, (value) => {
  if (value && pendingRedirect.value) {
    pendingRedirect.value = false;
    navigateTo(getRedirectPath());
  } else if (value) {
    navigateTo(getRedirectPath());
  }
}, { immediate: true });

async function submit() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const result = mode.value === 'signin'
      ? await authStore.signIn(email.value, password.value)
      : await authStore.signUp(email.value, password.value);

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
          label="Password"
          name="password"
        >
          <UInput
            v-model="password"
            type="password"
            name="password"
            autocomplete="current-password"
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
          :loading="loading"
          :label="mode === 'signin' ? 'Sign in' : 'Sign up'"
        />
      </form>

      <p class="text-center text-sm text-muted">
        <button
          type="button"
          class="text-primary underline-offset-4 hover:underline"
          @click="mode = mode === 'signin' ? 'signup' : 'signin'"
        >
          {{ mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in' }}
        </button>
      </p>
    </div>
  </UContainer>
</template>
