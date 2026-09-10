import { createError } from 'h3';
import type { AgentSession } from './agent-session';

export type ProposedOperation = {
  name: string;
  args: Record<string, unknown>;
};

type ProposalRow = {
  id: string;
  user_id: string;
  preview: string;
  operations: ProposedOperation[];
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  expires_at: string;
  connection_updated_at: string;
};

const endpoint = (session: AgentSession) => `${session.env.supabaseUrl}/rest/v1/agent_pending_proposals`;
const headers = (session: AgentSession) => ({
  'apikey': session.env.serviceRoleKey,
  'Authorization': `Bearer ${session.env.serviceRoleKey}`,
  'Content-Type': 'application/json'
});

const configured = (session: AgentSession) => {
  if (!session.env.supabaseUrl || !session.env.serviceRoleKey) {
    throw createError({ statusCode: 500, statusMessage: 'Agent proposal storage is not configured.' });
  }
};

export const createPendingProposal = async (
  session: AgentSession,
  connectionUpdatedAt: string,
  preview: string,
  operations: ProposedOperation[]
) => {
  configured(session);
  const response = await fetch(endpoint(session), {
    method: 'POST',
    headers: { ...headers(session), Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: session.userId,
      connection_updated_at: connectionUpdatedAt,
      prompt: 'Assistant-generated proposal',
      preview,
      operations
    })
  });
  const rows = await response.json().catch(() => []) as ProposalRow[];
  if (!response.ok || !rows[0]) throw createError({ statusCode: 500, statusMessage: 'Failed to save the proposal.' });
  return rows[0];
};

export const claimPendingProposal = async (
  session: AgentSession,
  proposalId: string,
  connectionUpdatedAt: string
) => {
  configured(session);
  const filter = `id=eq.${proposalId}&user_id=eq.${session.userId}&status=eq.pending&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&connection_updated_at=eq.${encodeURIComponent(connectionUpdatedAt)}`;
  const response = await fetch(`${endpoint(session)}?${filter}`, {
    method: 'PATCH',
    headers: { ...headers(session), Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'confirmed', confirmed_at: new Date().toISOString() })
  });
  const rows = await response.json().catch(() => []) as ProposalRow[];
  if (!response.ok) throw createError({ statusCode: 500, statusMessage: 'Failed to confirm the proposal.' });
  if (!rows[0]) throw createError({ statusCode: 409, statusMessage: 'This proposal is stale, expired, or already confirmed.' });
  return rows[0];
};

export const readConfirmedProposal = async (session: AgentSession, proposalId: string) => {
  configured(session);
  const response = await fetch(`${endpoint(session)}?id=eq.${proposalId}&user_id=eq.${session.userId}&status=eq.confirmed&select=*`, {
    headers: headers(session)
  });
  const rows = await response.json().catch(() => []) as ProposalRow[];
  return response.ok ? rows[0] ?? null : null;
};
