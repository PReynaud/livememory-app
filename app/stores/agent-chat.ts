import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useSupabaseClient } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import type { Database } from '@/types/database.types';
import {
  ASSISTANT_ADDED,
  ASSISTANT_LOG_UNCHANGED,
  ASSISTANT_NOT_ADDED,
  type AgentProposalCard
} from '#shared/agent-chat-transcript';

export type AgentMessage = {
  role: 'user' | 'assistant';
  text: string;
  card?: AgentProposalCard | null;
  status?: 'pending' | 'added' | 'skipped';
};
export type PromptImage = { data: string; mimeType: string };

type TurnResponse = {
  text: string;
  proposalId: string;
  requiresConfirmation: boolean;
  card: AgentProposalCard | null;
};

const readCard = (value: unknown): AgentProposalCard | null => {
  if (!value || typeof value !== 'object') return null;
  const card = value as AgentProposalCard;
  if (typeof card.artist !== 'string') return null;
  return {
    artist: card.artist,
    dateLabel: typeof card.dateLabel === 'string' ? card.dateLabel : '',
    place: typeof card.place === 'string' ? card.place : '',
    time: typeof card.time === 'string' ? card.time : '',
    stageName: typeof card.stageName === 'string' ? card.stageName : '',
    attendance: card.attendance === 'attended' ? 'attended' : 'going',
    note: typeof card.note === 'string' && !card.note.includes('{') ? card.note : ''
  };
};

export const useAgentChatStore = defineStore('agentChat', () => {
  const supabase = useSupabaseClient<Database>();
  const connected = ref(false);
  const healthy = ref(false);
  const open = ref(false);
  const loading = ref(false);
  const turnLoading = ref(false);
  const confirming = ref(false);
  const error = ref<string | null>(null);
  const messages = ref<AgentMessage[]>([]);
  const pendingPreview = ref<string | null>(null);
  const pendingProposalId = ref<string | null>(null);
  const isReady = computed(() => connected.value && healthy.value);

  const headers = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('Authentication is required.');
    return { Authorization: `Bearer ${data.session.access_token}` };
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

  const settlePending = (status: 'added' | 'skipped', text: string) => {
    messages.value = messages.value.map((message) => {
      if (message.status !== 'pending') return message;
      return { ...message, status, text };
    });
    pendingPreview.value = null;
    pendingProposalId.value = null;
  };

  const send = async (prompt: string, images: PromptImage[]) => {
    if (turnLoading.value || confirming.value || pendingProposalId.value) {
      return { data: null, error: 'Choose Add concert or Don\'t add before asking again.' };
    }
    turnLoading.value = true;
    error.value = null;
    messages.value.push({ role: 'user', text: prompt });
    try {
      const data = await $fetch<TurnResponse>('/api/agent/turn', {
        method: 'POST', headers: await headers(), body: { prompt, images }
      });
      const assistant: AgentMessage = { role: 'assistant', text: data.text };
      const card = readCard(data.card);
      if (card) assistant.card = card;
      if (data.requiresConfirmation) {
        assistant.status = 'pending';
        pendingPreview.value = data.text;
        pendingProposalId.value = data.proposalId;
      } else {
        pendingPreview.value = null;
        pendingProposalId.value = null;
      }
      messages.value.push(assistant);
      return { data, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'The assistant could not complete this turn.');
      error.value = message;
      return { data: null, error: message };
    } finally {
      turnLoading.value = false;
    }
  };

  const confirm = async () => {
    if (confirming.value) return { data: null, error: 'Adding' };
    if (!pendingProposalId.value) return { data: null, error: 'There is no proposal to confirm.' };
    confirming.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ text: string }>('/api/agent/confirm', {
        method: 'POST', headers: await headers(), body: { proposalId: pendingProposalId.value }
      });
      const receipt = typeof data.text === 'string' && !data.text.includes('{') ? data.text : ASSISTANT_ADDED;
      settlePending('added', receipt);
      return { data, error: null };
    } catch {
      error.value = ASSISTANT_LOG_UNCHANGED;
      return { data: null, error: ASSISTANT_LOG_UNCHANGED };
    } finally {
      confirming.value = false;
    }
  };

  const cancelPreview = () => {
    settlePending('skipped', ASSISTANT_NOT_ADDED);
  };

  return {
    connected, healthy, open, loading, turnLoading, confirming, error, messages,
    pendingPreview, pendingProposalId, isReady,
    fetchStatus, connect, disconnect, send, confirm, cancelPreview
  };
});
