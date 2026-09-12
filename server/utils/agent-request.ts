import { createError, getRequestHeader, getRequestURL, type H3Event } from 'h3';
import { useRuntimeConfig } from '#imports';
import { getAgentConnection } from './agent-connections';
import { trustedAgentOrigins } from './agent-origin';
import { runAgentTurn, type PromptImage } from './agent-runner';
import { requireAgentSession } from './agent-session';
import { claimPendingProposal, createPendingProposal } from './agent-proposals';

const MIME_TYPES = new Set<PromptImage['mimeType']>([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp'
]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 50 * 1024 * 1024;

export const validatePromptImages = (images: unknown): PromptImage[] => {
  if (!Array.isArray(images) || images.length > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Use at most five image files.' });
  }
  const validated = images.map((image) => {
    const value = image as { data?: unknown; mimeType?: unknown };
    if (typeof value.data !== 'string' || !MIME_TYPES.has(value.mimeType as PromptImage['mimeType'])) {
      throw createError({ statusCode: 400, statusMessage: 'Images must be PNG, JPEG, GIF, or WebP.' });
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value.data) || value.data.length % 4 === 1) {
      throw createError({ statusCode: 400, statusMessage: 'Image data is invalid.' });
    }
    if (Buffer.from(value.data, 'base64').byteLength > MAX_IMAGE_BYTES) {
      throw createError({ statusCode: 400, statusMessage: 'Each image must be 15 MB or smaller.' });
    }
    return { data: value.data, mimeType: value.mimeType as PromptImage['mimeType'] };
  });
  if (validated.reduce((total, image) => total + Buffer.from(image.data, 'base64').byteLength, 0) > MAX_TOTAL_IMAGE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Images must total 50 MB or less.' });
  }
  return validated;
};

export const assertTrustedAgentOrigin = (event: H3Event, allowedOrigin: string) => {
  const requestOrigin = getRequestURL(event).origin;
  const origin = getRequestHeader(event, 'origin');
  if (!origin || !trustedAgentOrigins(requestOrigin, allowedOrigin).has(origin)) {
    throw createError({ statusCode: 403, statusMessage: 'Untrusted request origin.' });
  }
  return requestOrigin;
};

export const handleAgentRequest = async (
  event: H3Event,
  prompt: unknown,
  images: unknown,
  scope: 'read' | 'write'
) => {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'A message is required.' });
  }
  const session = await requireAgentSession(event);
  const connection = await getAgentConnection(session);
  if (!connection || connection.health !== 'healthy') {
    throw createError({ statusCode: 409, statusMessage: 'Connect Cursor in Profile before using the assistant.' });
  }
  const config = useRuntimeConfig(event);
  const capabilitySecret = String(config.agentCapabilitySecret || '');
  if (!capabilitySecret) throw createError({ statusCode: 500, statusMessage: 'Agent capability security is not configured.' });
  const origin = assertTrustedAgentOrigin(event, String(config.agentAllowedOrigin || ''));
  const result = await runAgentTurn({
    session,
    connection,
    prompt: prompt.trim(),
    scope,
    images: validatePromptImages(images),
    encryptionSecret: String(config.agentCredentialEncryptionKey || ''),
    capabilitySecret,
    origin
  });
  if (scope === 'read') {
    const proposal = await createPendingProposal(
      session,
      connection.updated_at,
      result.proposal?.preview ?? result.text,
      result.proposal?.operations ?? []
    );
    return { ...result, text: proposal.preview, proposalId: proposal.id, requiresConfirmation: proposal.operations.length > 0 };
  }
  return result;
};

export const confirmAgentRequest = async (event: H3Event, proposalId: unknown) => {
  if (typeof proposalId !== 'string' || !proposalId) {
    throw createError({ statusCode: 400, statusMessage: 'A proposal is required.' });
  }
  const config = useRuntimeConfig(event);
  const capabilitySecret = String(config.agentCapabilitySecret || '');
  if (!capabilitySecret) throw createError({ statusCode: 500, statusMessage: 'Agent capability security is not configured.' });
  const origin = assertTrustedAgentOrigin(event, String(config.agentAllowedOrigin || ''));
  const session = await requireAgentSession(event);
  const connection = await getAgentConnection(session);
  if (!connection || connection.health !== 'healthy') {
    throw createError({ statusCode: 409, statusMessage: 'Connect Cursor in Profile before using the assistant.' });
  }
  const proposal = await claimPendingProposal(session, proposalId, connection.updated_at);
  return await runAgentTurn({
    session,
    connection,
    prompt: JSON.stringify(proposal.operations),
    scope: 'write',
    images: [],
    encryptionSecret: String(config.agentCredentialEncryptionKey || ''),
    capabilitySecret,
    origin,
    proposalId: proposal.id
  });
};
