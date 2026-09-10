import { createError, defineEventHandler, readBody } from 'h3';
import { useRuntimeConfig } from '#imports';
import { Cursor } from '@cursor/sdk';
import { assertTrustedAgentOrigin } from '../../utils/agent-request';
import { saveAgentConnection } from '../../utils/agent-connections';
import { requireAgentSession } from '../../utils/agent-session';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ credential?: unknown }>(event);
  const credential = typeof body?.credential === 'string' ? body.credential.trim() : '';
  if (!credential) {
    throw createError({ statusCode: 400, statusMessage: 'A Cursor API key is required.' });
  }
  try {
    await Cursor.me({ apiKey: credential });
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Cursor rejected this API key.' });
  }
  const config = useRuntimeConfig(event);
  assertTrustedAgentOrigin(event, String(config.agentAllowedOrigin || ''));
  await saveAgentConnection(
    await requireAgentSession(event),
    credential,
    String(config.agentCredentialEncryptionKey || '')
  );
  return { connected: true, healthy: true };
});
