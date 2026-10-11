import { defineEventHandler, readBody } from 'h3';
import { handleAgentRequest } from '../../utils/agent-request';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ prompt?: unknown; images?: unknown }>(event);
  return await handleAgentRequest(event, body?.prompt, body?.images, 'read');
});
