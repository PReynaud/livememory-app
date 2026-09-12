import { Agent, CursorAgentError, type SDKImage } from '@cursor/sdk';
import { createError } from 'h3';
import type { AgentSession } from './agent-session';
import { mintAgentCapability } from './agent-capability';
import {
  readAgentCredential,
  updateAgentConnection
} from './agent-connections';
import type { ProposedOperation } from './agent-proposals';

type AgentConnection = NonNullable<Awaited<ReturnType<typeof import('./agent-connections').getAgentConnection>>>;

export type PromptImage = { data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' };

export const runAgentTurn = async (options: {
  session: AgentSession;
  connection: AgentConnection;
  prompt: string;
  scope: 'read' | 'write';
  images: PromptImage[];
  encryptionSecret: string;
  capabilitySecret: string;
  origin: string;
  proposalId?: string;
}) => {
  const credential = readAgentCredential(
    options.connection,
    options.encryptionSecret,
    options.session.env.serviceRoleKey
  );
  const capability = mintAgentCapability({
    userId: options.session.userId,
    scope: options.scope,
    proposalId: options.proposalId,
    connectionUpdatedAt: options.connection.updated_at
  }, options.capabilitySecret);
  const mcpServers = {
    livememory: {
      type: 'http' as const,
      url: `${options.origin}/api/agent/mcp`,
      headers: { 'x-livememory-agent-capability': capability }
    }
  };
  const agentOptions = {
    apiKey: credential,
    model: {
      id: 'composer-2.5',
      params: [{ id: 'fast', value: 'false' }]
    },
    cloud: { repos: [], skipReviewerRequest: true },
    mcpServers
  };

  try {
    const agent = options.connection.agent_id
      ? await Agent.resume(options.connection.agent_id, agentOptions)
      : await Agent.create(agentOptions);
    try {
      const run = await agent.send({
        text: options.scope === 'read'
          ? `${options.prompt}\n\nUse LiveMemory only to inspect records. Do not claim changes were made. If details are sufficient, respond as one JSON object: {"preview":"affected records and fields","operations":[{"name":"tool name","args":{}}]}. Only use supported LiveMemory mutation tools. If details are incomplete, operations must be empty and preview must ask one focused follow-up question.`
          : `Execute only the operations stored in the confirmed proposal. Do not add or alter operations. Summarize the result for this proposal: ${options.prompt}`,
        images: options.images as SDKImage[]
      });
      const result = await run.wait();
      if (result.status === 'error') {
        throw createError({ statusCode: 502, statusMessage: 'Cursor could not complete this turn.' });
      }
      const text = result.result ?? '';
      await updateAgentConnection(options.session, { agent_id: agent.agentId, health: 'healthy' })
        .catch(() => undefined);
      return {
        agentId: agent.agentId,
        text,
        requiresConfirmation: options.scope === 'read',
        proposal: options.scope === 'read' ? parseProposal(text) : undefined
      };
    } finally {
      await agent[Symbol.asyncDispose]();
    }
  } catch (error: unknown) {
    await updateAgentConnection(options.session, { health: 'unhealthy' }).catch(() => undefined);
    if (error instanceof CursorAgentError) {
      throw createError({ statusCode: 502, statusMessage: 'Your Cursor connection needs to be reconnected.' });
    }
    throw error;
  }
};

const WRITE_TOOL_NAMES = new Set([
  'create_event', 'update_event', 'delete_event', 'create_concert', 'update_concert',
  'move_concert', 'delete_concert', 'set_attendance', 'clear_attendance',
  'attend_this_night', 'join_event', 'leave_event'
]);

export const parseProposal = (text: string): { preview: string; operations: ProposedOperation[] } => {
  try {
    const parsed = JSON.parse(text) as { preview?: unknown; operations?: unknown };
    if (typeof parsed.preview !== 'string' || !Array.isArray(parsed.operations)) {
      return { preview: text, operations: [] };
    }
    const operations = parsed.operations.filter((operation): operation is ProposedOperation => {
      const value = operation as ProposedOperation;
      return Boolean(value && WRITE_TOOL_NAMES.has(value.name)
        && value.args && typeof value.args === 'object' && !Array.isArray(value.args));
    });
    return { preview: parsed.preview, operations };
  } catch {
    return { preview: text, operations: [] };
  }
};
