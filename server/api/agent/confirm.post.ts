import { defineEventHandler, readBody } from 'h3';
import { confirmAgentRequest } from '../../utils/agent-request';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ proposalId?: unknown }>(event);
  return await confirmAgentRequest(event, body?.proposalId);
});
