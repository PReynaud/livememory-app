import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useSupabaseClient, useSupabaseSession } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import type { Database } from '@/types/database.types';

export type AgentMessage = { role: 'user' | 'assistant'; text: string };
export type PromptImage = { data: string; mimeType: string };

export const useAgentChatStore = defineStore('agentChat', () => {
  const supabase = useSupabaseClient<Database>();
  const supabaseSession = useSupabaseSession();
  const connected = ref(false);
  const healthy = ref(false);
  const open = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const messages = ref<AgentMessage[]>([]);
  const pendingPreview = ref<string | null>(null);
  const pendingProposalId = ref<string | null>(null);
  const isReady = computed(() => connected.value && healthy.value);

  const headers = async () => {
    let token = supabaseSession.value?.access_token ?? null;
    if (!token) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
    }
    if (!token) {
      const { data } = await supabase.auth.refreshSession();
      token = data.session?.access_token ?? null;
    }
    if (!token) throw new Error('Authentication is required.');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchStatus = async () => {
    loading.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ connected: boolean; healthy: boolean }>('/api/agent/connection', {
        headers: await headers()
      });
      connected.value = data.connected;
      healthy.value = data.healthy;
      return { data, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to load Cursor connection.');
      error.value = message;
      return { data: null, error: message };
    } finally {
      loading.value = false;
    }
  };

  const connect = async (credential: string) => {
    loading.value = true;
    error.value = null;
    try {
      await $fetch('/api/agent/connection', {
        method: 'POST', headers: await headers(), body: { credential }
      });
      connected.value = true;
      healthy.value = true;
      return { data: true, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to connect Cursor.');
      error.value = message;
      return { data: null, error: message };
    } finally {
      loading.value = false;
    }
  };

  const disconnect = async () => {
    loading.value = true;
    error.value = null;
    try {
      await $fetch('/api/agent/connection', { method: 'DELETE', headers: await headers() });
      connected.value = false;
      healthy.value = false;
      messages.value = [];
      pendingPreview.value = null;
      pendingProposalId.value = null;
      return { data: true, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to disconnect Cursor.');
      error.value = message;
      return { data: null, error: message };
    } finally {
      loading.value = false;
    }
  };

  const send = async (prompt: string, images: PromptImage[]) => {
    if (loading.value || pendingProposalId.value) {
      return { data: null, error: 'Confirm or cancel the current proposal first.' };
    }
    loading.value = true;
    error.value = null;
    messages.value.push({ role: 'user', text: prompt });
    try {
      const data = await $fetch<{ text: string; proposalId: string; requiresConfirmation: boolean }>('/api/agent/turn', {
        method: 'POST', headers: await headers(), body: { prompt, images }
      });
      messages.value.push({ role: 'assistant', text: data.text });
      pendingPreview.value = data.requiresConfirmation ? data.text : null;
      pendingProposalId.value = data.requiresConfirmation ? data.proposalId : null;
      return { data, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'The assistant could not complete this turn.');
      error.value = message;
      return { data: null, error: message };
    } finally {
      loading.value = false;
    }
  };

  const confirm = async () => {
    if (!pendingPreview.value || !pendingProposalId.value) return { data: null, error: 'There is no proposal to confirm.' };
    loading.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ text: string }>('/api/agent/confirm', {
        method: 'POST', headers: await headers(), body: { proposalId: pendingProposalId.value }
      });
      messages.value.push({ role: 'assistant', text: data.text });
      pendingPreview.value = null;
      pendingProposalId.value = null;
      return { data, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'The confirmed change could not be completed.');
      error.value = message;
      return { data: null, error: message };
    } finally {
      loading.value = false;
    }
  };

  const cancelPreview = () => {
    pendingPreview.value = null;
    pendingProposalId.value = null;
  };

  return {
    connected, healthy, open, loading, error, messages, pendingPreview, pendingProposalId, isReady,
    fetchStatus, connect, disconnect, send, confirm, cancelPreview
  };
});
