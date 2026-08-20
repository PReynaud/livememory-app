import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { invokeLogTool, toMcpToolResult, type McpToolName } from './mcp-log-tools';

const eventKindSchema = z.enum(['single_night', 'festival']);
const confirmChoiceSchema = z.enum(['attach', 'create']);
const attendanceStatusSchema = z.enum(['going', 'attended']);

const createEventShape = {
  kind: eventKindSchema.describe('single_night or festival'),
  name: z.string().describe('Event name'),
  startDate: z.string().describe('Start date YYYY-MM-DD in Europe/Paris'),
  endDate: z.string().optional().describe('End date YYYY-MM-DD; required for festival'),
  place: z.string().describe('Event Place')
};

const run = async (
  name: McpToolName,
  args: Record<string, unknown>,
  client: unknown
) => {
  const json = await invokeLogTool(name, args, client);
  return toMcpToolResult(json);
};

export const createLiveMemoryMcpServer = (client: unknown) => {
  const server = new McpServer({
    name: 'livememory',
    version: '1.0.0'
  });

  server.registerTool('list_events', {
    title: 'List events',
    description:
      'List Events the acting User owns or has joined, using the same domain list as the Concerts UI.'
  }, async () => run('list_events', {}, client));

  server.registerTool('get_event', {
    title: 'Get event',
    description: 'Read one Event the acting User can see, with its Concerts and Stage/Scene list.',
    inputSchema: {
      eventId: z.string().describe('Event id')
    }
  }, async ({ eventId }) => run('get_event', { eventId }, client));

  server.registerTool('create_event', {
    title: 'Create event',
    description: 'Create a single_night or festival Event with the same fields and rules as the form.',
    inputSchema: createEventShape
  }, async args => run('create_event', args, client));

  server.registerTool('update_event', {
    title: 'Update event',
    description:
      'Update an owned Event. Date, Place, and Stage rules match the UI. Pass concertDates to save Event and Concert dates together.',
    inputSchema: {
      eventId: z.string().describe('Event id'),
      name: z.string().describe('Event name'),
      startDate: z.string().describe('Start date YYYY-MM-DD'),
      endDate: z.string().optional().describe('End date YYYY-MM-DD; required for festival'),
      place: z.string().describe('Event Place'),
      allowPlaceOverride: z.boolean().optional().describe('Whether Concerts may use a different Place'),
      stages: z.array(z.object({
        id: z.string().optional(),
        name: z.string()
      })).optional().describe('Stage/Scene list; empty means a Stage is not required'),
      concertDates: z.array(z.object({
        concertId: z.string(),
        date: z.string(),
        stageId: z.string().nullable().optional()
      })).optional().describe('Optional Concert date/stage updates in the same save')
    }
  }, async args => run('update_event', args, client));

  server.registerTool('delete_event', {
    title: 'Delete event',
    description:
      'Delete an owned Event. Non-empty Events, and Events with joiners, require confirm=true. Same deletion rules as the UI.',
    inputSchema: {
      eventId: z.string().describe('Event id'),
      confirm: z.boolean().optional().describe('Required when the Event has Concerts or joiners')
    }
  }, async args => run('delete_event', args, client));

  server.registerTool('list_concerts', {
    title: 'List concerts',
    description:
      'List Concerts the acting User can see. Pass eventId to list one Event bill. Notes are owner-only.',
    inputSchema: {
      eventId: z.string().optional().describe('Optional Event id')
    }
  }, async args => run('list_concerts', args, client));

  server.registerTool('create_concert', {
    title: 'Create concert',
    description:
      'Create a Concert with the same identity rules as the UI. Outcomes are created, attached, needs_choice, or impossible_place. When needs_choice, call again with confirm attach or create. Omit eventId and newEvent to transparently create a single_night Event.',
    inputSchema: {
      artist: z.string().describe('Artist or group'),
      date: z.string().describe('Concert date YYYY-MM-DD'),
      time: z.string().nullable().optional().describe('Optional clock time HH:MM'),
      place: z.string().optional().describe('Place; required for transparent create'),
      stageId: z.string().nullable().optional().describe('Stage/Scene id when the Event has a list'),
      eventId: z.string().optional().describe('Existing Event id'),
      newEvent: z.object(createEventShape).optional().describe('Create this Event and add the Concert to it'),
      confirm: confirmChoiceSchema.optional().describe('attach or create when identity needs a choice')
    }
  }, async args => run('create_concert', args, client));

  server.registerTool('update_concert', {
    title: 'Update concert',
    description: 'Update an owned Concert. Identity, dates, Place, and Stage rules match the UI.',
    inputSchema: {
      concertId: z.string().describe('Concert id'),
      artist: z.string().describe('Artist or group'),
      date: z.string().describe('Concert date YYYY-MM-DD'),
      time: z.string().nullable().optional().describe('Optional clock time HH:MM'),
      notes: z.string().nullable().optional().describe('Owner notes; omitted for joiners'),
      place: z.string().optional().describe('Place override when the Event allows it'),
      stageId: z.string().nullable().optional().describe('Stage/Scene id'),
      eventId: z.string().optional().describe('Leave unset unless also moving via update'),
      confirm: confirmChoiceSchema.optional().describe('attach or create when identity needs a choice')
    }
  }, async args => run('update_concert', args, client));

  server.registerTool('move_concert', {
    title: 'Move concert',
    description:
      'Move an owned Concert to another owned Event. Does not auto-join source joiners. Requires confirm=true when joiners would lose the Concert.',
    inputSchema: {
      concertId: z.string().describe('Concert id'),
      targetEventId: z.string().describe('Target Event id owned by the acting User'),
      place: z.string().optional(),
      stageId: z.string().nullable().optional(),
      confirm: z.boolean().optional().describe('Required when joiners of the source would lose the Concert')
    }
  }, async args => run('move_concert', args, client));

  server.registerTool('delete_concert', {
    title: 'Delete concert',
    description:
      'Delete an owned Concert. Requires confirm=true when joiners would lose it and their Attendance.',
    inputSchema: {
      concertId: z.string().describe('Concert id'),
      confirm: z.boolean().optional().describe('Required when any non-owner has joined the Event')
    }
  }, async args => run('delete_concert', args, client));

  server.registerTool('list_event_stages', {
    title: 'List event stages',
    description: 'List Stage/Scene names on an Event.',
    inputSchema: {
      eventId: z.string().describe('Event id')
    }
  }, async ({ eventId }) => run('list_event_stages', { eventId }, client));

  server.registerTool('list_attendance', {
    title: 'List attendance',
    description:
      'List the acting User\'s effective Attendance (going or attended). Past stored going reads as attended.'
  }, async () => run('list_attendance', {}, client));

  server.registerTool('set_attendance', {
    title: 'Set attendance',
    description:
      'Set the acting User\'s Attendance on a Concert they can see. going, attended, or use clear_attendance to unset.',
    inputSchema: {
      concertId: z.string().describe('Concert id'),
      status: attendanceStatusSchema.describe('going or attended')
    }
  }, async args => run('set_attendance', args, client));

  server.registerTool('clear_attendance', {
    title: 'Clear attendance',
    description: 'Clear the acting User\'s Attendance on a Concert. The Concert stays on the Event.',
    inputSchema: {
      concertId: z.string().describe('Concert id')
    }
  }, async ({ concertId }) => run('clear_attendance', { concertId }, client));

  server.registerTool('attend_this_night', {
    title: 'Attend this night',
    description:
      'Mark Attendance on every Concert currently on a single_night Event. Not available on festival Events.',
    inputSchema: {
      eventId: z.string().describe('single_night Event id')
    }
  }, async ({ eventId }) => run('attend_this_night', { eventId }, client));

  server.registerTool('join_event', {
    title: 'Join event',
    description:
      'Join an Event by id as the acting User. Same membership insert as opening the Event URL while signed in. The owner cannot join their own Event.',
    inputSchema: {
      eventId: z.string().describe('Event id')
    }
  }, async ({ eventId }) => run('join_event', { eventId }, client));

  server.registerTool('leave_event', {
    title: 'Leave event',
    description:
      'Leave a joined Event. Deletes the acting User\'s membership and their Attendance on that Event\'s Concerts. The owner cannot leave.',
    inputSchema: {
      eventId: z.string().describe('Event id')
    }
  }, async ({ eventId }) => run('leave_event', { eventId }, client));

  return server;
};
