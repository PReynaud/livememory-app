import { defineEventHandler } from 'h3';
import { connectionStatus } from '../../utils/agent-connections';
import { requireAgentSession } from '../../utils/agent-session';

export default defineEventHandler(async (event) => {
  return await connectionStatus(await requireAgentSession(event));
});
