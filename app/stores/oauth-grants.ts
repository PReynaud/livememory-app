import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabaseClient, useToast } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import { notifyOfflineWrite } from '@/utils/online-write';
import type { Database } from '@/types/database.types';
import {
  getOauthClient,
  listOauthGrants,
  revokeOauthGrant,
  type OauthClientName,
  type OauthDirectoryClient,
  type OauthGrantListItem
} from '#shared/domain/oauth-grants';

export type OauthDecisionInput = {
  decision: 'allow' | 'deny';
  clientId: string;
  redirectUri: string;
  responseType: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  resource: string;
};

export const useOauthGrantsStore = defineStore('oauthGrants', () => {
  const supabase = useSupabaseClient<Database>();
  const client = supabase as unknown as OauthDirectoryClient;
  const toast = useToast();

  const grants = ref<OauthGrantListItem[]>([]);
  const clientName = ref<OauthClientName | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  const requireAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      throw new Error('Sign in required.');
    }

    return accessToken;
  };

  const requireUserId = async () => {
    const { data: session } = await supabase.auth.getUser();
    const userId = session.user?.id;
    if (!userId) {
      throw new Error('Profile not found');
    }

    return userId;
  };

  const fetchGrants = async () => {
    loading.value = true;
    error.value = null;
    grants.value = [];

    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) {
        grants.value = [];
        return { data: [], error: null };
      }

      const result = await listOauthGrants(client, userId);
      if (result.error || !result.data) {
        grants.value = [];
        throw new Error(result.error?.message ?? 'Failed to load connected clients');
      }

      grants.value = result.data;
      return { data: result.data, error: null };
    } catch (err: unknown) {
      grants.value = [];
      const errorMessage = getErrorMessage(err, 'Failed to load connected clients');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const revokeGrant = async (grantId: string) => {
    const offline = notifyOfflineWrite(toast);
    if (offline) {
      return { data: null, error: offline };
    }

    loading.value = true;
    error.value = null;

    try {
      const userId = await requireUserId();
      const result = await revokeOauthGrant(client, userId, grantId);
      if (result.error) {
        throw new Error(result.error.message);
      }

      grants.value = grants.value.filter(grant => grant.id !== grantId);
      return { data: true, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to revoke the client');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const fetchClient = async (clientId: string) => {
    loading.value = true;
    error.value = null;
    clientName.value = null;

    if (!clientId) {
      error.value = 'This client is not registered.';
      loading.value = false;
      return { data: null, error: error.value };
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        loading.value = false;
        return { data: null, error: null };
      }

      const result = await getOauthClient(client, clientId);
      if (result.error) {
        throw new Error(result.error.message);
      }

      if (!result.data) {
        clientName.value = null;
        error.value = 'This client is not registered.';
        return { data: null, error: error.value };
      }

      clientName.value = result.data;
      return { data: result.data, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to load the client');
      error.value = errorMessage;
      clientName.value = null;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const submitDecision = async (input: OauthDecisionInput) => {
    loading.value = true;
    error.value = null;

    try {
      const accessToken = await requireAccessToken();
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          decision: input.decision,
          client_id: input.clientId,
          redirect_uri: input.redirectUri,
          response_type: input.responseType,
          code_challenge: input.codeChallenge,
          code_challenge_method: input.codeChallengeMethod,
          state: input.state,
          resource: input.resource
        })
      });
      const payload = await response.json().catch(() => null) as {
        redirect?: string;
        error_description?: string;
      } | null;
      if (!response.ok || !payload?.redirect) {
        const message = payload?.error_description || 'Could not complete authorization.';
        error.value = message;
        return { data: null, error: message };
      }

      return { data: { redirect: payload.redirect }, error: null };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Could not complete authorization.');
      error.value = errorMessage;
      return { data: null, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  return {
    grants,
    clientName,
    loading,
    error,
    fetchGrants,
    revokeGrant,
    fetchClient,
    submitDecision
  };
});
