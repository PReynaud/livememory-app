import { defineEventHandler } from 'h3';
import { useRuntimeConfig } from '#imports';
import { removeAgentConnection } from '../../utils/agent-connections';
import { requireAgentSession } from '../../utils/agent-session';
import { assertTrustedAgentOrigin } from '../../utils/agent-request';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  assertTrustedAgentOrigin(event, String(config.agentAllowedOrigin || ''));
  await removeAgentConnection(await requireAgentSession(event));
  return { connected: false, healthy: false };
});
