import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { invokeLogTool, toMcpToolResult, type McpToolName } from './mcp-log-tools';
import type { ProposedOperation } from './agent-proposals';

const call = async (
  name: McpToolName,
  args: Record<string, unknown>,
  client: unknown,
  allowedOperations?: ProposedOperation[]
) => {
  if (allowedOperations && !allowedOperations.some(operation =>
    operation.name === name && JSON.stringify(operation.args) === JSON.stringify(args))) {
    return toMcpToolResult({ ok: false, ruleId: 'proposal_scope', message: 'This operation is outside the confirmed proposal.' });
  }
  return toMcpToolResult(await invokeLogTool(name, args, client));
};

const eventShape = {
  kind: z.enum(['single_night', 'festival']),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  place: z.string()
};

/**
 * An intentionally separate MCP surface for embedded agents. The public MCP
 * route retains its personal-key behaviour; a short-lived capability decides
 * which tools Cursor can discover for this one turn.
 */
export const createEmbeddedMcpServer = (
  client: unknown,
  scope: 'read' | 'write',
  allowedOperations?: ProposedOperation[]
) => {
  const server = new McpServer({ name: 'livememory-embedded', version: '1.0.0' });
  server.registerTool('list_events', {}, () => call('list_events', {}, client));
  server.registerTool('get_event', { inputSchema: { eventId: z.string() } },
    ({ eventId }) => call('get_event', { eventId }, client));
  server.registerTool('list_concerts', { inputSchema: { eventId: z.string().optional() } },
    args => call('list_concerts', args, client));
  server.registerTool('list_event_stages', { inputSchema: { eventId: z.string() } },
    ({ eventId }) => call('list_event_stages', { eventId }, client));
  server.registerTool('list_attendance', {}, () => call('list_attendance', {}, client));

  if (scope === 'read') return server;

  server.registerTool('create_event', { inputSchema: eventShape },
    args => call('create_event', args, client, allowedOperations));
  server.registerTool('create_concert', {
    inputSchema: {
      artist: z.string(), date: z.string(), time: z.string().nullable().optional(),
      place: z.string().optional(), stageId: z.string().nullable().optional(),
      stageName: z.string().nullable().optional(), eventId: z.string().optional(),
      newEvent: z.object(eventShape).optional(), confirm: z.enum(['attach', 'create']).optional()
    }
  }, args => call('create_concert', args, client, allowedOperations));
  server.registerTool('update_event', { inputSchema: { eventId: z.string(), ...eventShape } },
    args => call('update_event', args, client, allowedOperations));
  server.registerTool('delete_event', { inputSchema: { eventId: z.string(), confirm: z.boolean().optional() } },
    args => call('delete_event', args, client, allowedOperations));
  server.registerTool('update_concert', { inputSchema: { concertId: z.string(), artist: z.string(), date: z.string() } },
    args => call('update_concert', args, client, allowedOperations));
  server.registerTool('move_concert', { inputSchema: { concertId: z.string(), targetEventId: z.string(), confirm: z.boolean().optional() } },
    args => call('move_concert', args, client, allowedOperations));
  server.registerTool('delete_concert', { inputSchema: { concertId: z.string(), confirm: z.boolean().optional() } },
    args => call('delete_concert', args, client, allowedOperations));
  server.registerTool('set_attendance', {
    inputSchema: { concertId: z.string(), status: z.enum(['going', 'attended']) }
  }, args => call('set_attendance', args, client, allowedOperations));
  server.registerTool('clear_attendance', { inputSchema: { concertId: z.string() } },
    args => call('clear_attendance', args, client, allowedOperations));
  server.registerTool('attend_this_night', { inputSchema: { eventId: z.string() } },
    args => call('attend_this_night', args, client, allowedOperations));
  server.registerTool('join_event', { inputSchema: { eventId: z.string() } },
    args => call('join_event', args, client, allowedOperations));
  server.registerTool('leave_event', { inputSchema: { eventId: z.string() } },
    args => call('leave_event', args, client, allowedOperations));
  return server;
};
