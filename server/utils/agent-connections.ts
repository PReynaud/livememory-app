import { createError } from 'h3';
import type { AgentSession } from './agent-session';
import { decryptAgentCredential, encryptAgentCredential, resolveAgentEncryptionSecret } from './agent-crypto';

export type AgentConnectionRow = {
  user_id: string;
  credential_ciphertext: string;
  credential_iv: string;
  credential_auth_tag: string;
  agent_id: string | null;
  health: 'healthy' | 'unhealthy';
  updated_at: string;
};

const headers = (session: AgentSession) => ({
  'apikey': session.env.serviceRoleKey,
  'Authorization': `Bearer ${session.env.serviceRoleKey}`,
  'Content-Type': 'application/json'
});

const url = (session: AgentSession) => `${session.env.supabaseUrl}/rest/v1/agent_connections`;

const assertConfigured = (session: AgentSession) => {
  if (!session.env.supabaseUrl || !session.env.serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Agent connection storage is not configured.'
    });
  }
};

export const getAgentConnection = async (session: AgentSession) => {
  assertConfigured(session);
  const response = await fetch(`${url(session)}?user_id=eq.${session.userId}&select=*`, {
    headers: headers(session)
  });
  const rows = await response.json().catch(() => []) as AgentConnectionRow[];
  if (!response.ok) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load Cursor connection.' });
  }
  return rows[0] ?? null;
};

export const connectionStatus = async (session: AgentSession) => {
  const connection = await getAgentConnection(session);
  return { connected: Boolean(connection), healthy: connection?.health === 'healthy' };
};

export const saveAgentConnection = async (
  session: AgentSession,
  credential: string,
  encryptionSecret: string
) => {
  assertConfigured(session);
  let encrypted;
  try {
    encrypted = encryptAgentCredential(
      credential.trim(),
      resolveAgentEncryptionSecret(encryptionSecret, session.env.serviceRoleKey)
    );
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Agent credential encryption is not configured.'
    });
  }
  const response = await fetch(`${url(session)}?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...headers(session), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: session.userId,
      credential_ciphertext: encrypted.ciphertext,
      credential_iv: encrypted.iv,
      credential_auth_tag: encrypted.authTag,
      agent_id: null,
      health: 'healthy'
    })
  });
  if (!response.ok) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to save Cursor connection.' });
  }
};

export const removeAgentConnection = async (session: AgentSession) => {
  assertConfigured(session);
  const response = await fetch(`${url(session)}?user_id=eq.${session.userId}`, {
    method: 'DELETE',
    headers: headers(session)
  });
  if (!response.ok) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to disconnect Cursor.' });
  }
};

export const updateAgentConnection = async (
  session: AgentSession,
  update: Partial<Pick<AgentConnectionRow, 'agent_id' | 'health'>>
) => {
  assertConfigured(session);
  const response = await fetch(`${url(session)}?user_id=eq.${session.userId}`, {
    method: 'PATCH',
    headers: headers(session),
    body: JSON.stringify(update)
  });
  if (!response.ok) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update Cursor connection.' });
  }
};

export const readAgentCredential = (
  connection: AgentConnectionRow,
  encryptionSecret: string,
  fallbackSecret = ''
) => decryptAgentCredential({
  ciphertext: connection.credential_ciphertext,
  iv: connection.credential_iv,
  authTag: connection.credential_auth_tag
}, resolveAgentEncryptionSecret(encryptionSecret, fallbackSecret));
