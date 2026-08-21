import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CONCERT_IDENTITY, CONCERT_RULE_MESSAGE } from '../../shared/domain/concerts';
import { EVENT_RULE, EVENT_RULE_MESSAGE } from '../../shared/domain/events';
import { JOINER_IMPACT_COPY } from '../../shared/domain/membership';
import {
  invokeLogTool,
  liveMemoryLogDomain,
  MCP_NEEDS_CONFIRM,
  toMcpToolResult,
  type LogDomain,
  type McpToolJson
} from '../../server/utils/mcp-log-tools';
import { readPersonalKeyFromHeaders } from '../../server/utils/mcp-auth';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const concert = {
  id: 'concert-1',
  event_id: 'event-1',
  owner_id: 'user-1',
  artist: 'Justice',
  date: '2026-08-18',
  time: null,
  place: 'Paris'
};

const eventRow = {
  id: 'event-1',
  owner_id: 'user-1',
  kind: 'single_night' as const,
  name: 'Club Night',
  start_date: '2026-08-18',
  end_date: '2026-08-18',
  place: 'Paris'
};

const unused = async () => {
  throw new Error('unexpected domain call');
};

const domainStub = (overrides: Partial<LogDomain>): LogDomain => ({
  listOwnedEvents: unused as LogDomain['listOwnedEvents'],
  getOwnedEvent: unused as LogDomain['getOwnedEvent'],
  createEvent: unused as LogDomain['createEvent'],
  updateEvent: unused as LogDomain['updateEvent'],
  deleteEvent: unused as LogDomain['deleteEvent'],
  listEventStages: unused as LogDomain['listEventStages'],
  listConcertsForEvent: unused as LogDomain['listConcertsForEvent'],
  listOwnedConcerts: unused as LogDomain['listOwnedConcerts'],
  createConcert: unused as LogDomain['createConcert'],
  updateConcert: unused as LogDomain['updateConcert'],
  moveConcert: unused as LogDomain['moveConcert'],
  deleteConcert: unused as LogDomain['deleteConcert'],
  listMyAttendance: unused as LogDomain['listMyAttendance'],
  setAttendance: unused as LogDomain['setAttendance'],
  clearAttendance: unused as LogDomain['clearAttendance'],
  attendThisNight: unused as LogDomain['attendThisNight'],
  eventHasJoiners: unused as LogDomain['eventHasJoiners'],
  concertMoveWouldLoseJoiners: unused as LogDomain['concertMoveWouldLoseJoiners'],
  joinEvent: unused as LogDomain['joinEvent'],
  leaveEvent: unused as LogDomain['leaveEvent'],
  requireEventOwnerAccess: unused as LogDomain['requireEventOwnerAccess'],
  ...overrides
});

describe('MCP personal key headers', () => {
  it('reads Authorization Bearer or x-livememory-key', () => {
    expect(readPersonalKeyFromHeaders('Bearer lm_secret', undefined)).toBe('lm_secret');
    expect(readPersonalKeyFromHeaders(undefined, 'lm_header')).toBe('lm_header');
    expect(readPersonalKeyFromHeaders('Bearer lm_secret', 'lm_header')).toBe('lm_header');
    expect(readPersonalKeyFromHeaders('Basic nope', undefined)).toBe('');
  });
});

describe('MCP log tools call domain, not SQL', () => {
  it('create_concert forwards to domain createConcert and returns created', async () => {
    const createConcert = vi.fn().mockResolvedValue({
      data: concert,
      error: null,
      outcome: CONCERT_IDENTITY.created
    });
    const result = await invokeLogTool(
      'create_concert',
      { artist: 'Justice', date: '2026-08-18', place: 'Paris' },
      {},
      domainStub({ createConcert })
    );

    expect(createConcert).toHaveBeenCalledTimes(1);
    expect(createConcert.mock.calls[0]?.[1]).toMatchObject({
      artist: 'Justice',
      date: '2026-08-18',
      place: 'Paris'
    });
    expect(result).toEqual({
      ok: true,
      outcome: CONCERT_IDENTITY.created,
      data: concert
    });
  });

  it('returns attached, needs_choice, and impossible_place without warn-then-save-anyway', async () => {
    const attached = await invokeLogTool(
      'create_concert',
      { artist: 'Justice', date: '2026-08-18', time: '20:00', place: 'Paris' },
      {},
      domainStub({
        createConcert: vi.fn().mockResolvedValue({
          data: { ...concert, time: '20:00' },
          error: null,
          outcome: CONCERT_IDENTITY.attached
        })
      })
    );
    expect(attached.ok).toBe(true);
    expect(attached.outcome).toBe(CONCERT_IDENTITY.attached);

    const choice = await invokeLogTool(
      'create_concert',
      { artist: 'Justice', date: '2026-08-18', place: 'Paris' },
      {},
      domainStub({
        createConcert: vi.fn().mockResolvedValue({
          data: concert,
          error: null,
          outcome: CONCERT_IDENTITY.needsChoice
        })
      })
    );
    expect(choice).toMatchObject({
      ok: false,
      outcome: CONCERT_IDENTITY.needsChoice,
      ruleId: CONCERT_IDENTITY.needsChoice,
      message: CONCERT_RULE_MESSAGE.needsChoice,
      confirm: ['attach', 'create']
    });
    expect(toMcpToolResult(choice).isError).toBe(false);

    const refused = await invokeLogTool(
      'create_concert',
      { artist: 'Justice', date: '2026-08-18', time: '20:00', place: 'Lyon' },
      {},
      domainStub({
        createConcert: vi.fn().mockResolvedValue({
          data: null,
          error: {
            ruleId: CONCERT_IDENTITY.impossiblePlace,
            message: CONCERT_RULE_MESSAGE.impossiblePlace
          },
          outcome: CONCERT_IDENTITY.impossiblePlace
        })
      })
    );
    expect(refused.ok).toBe(false);
    expect(refused.outcome).toBe(CONCERT_IDENTITY.impossiblePlace);
    expect(toMcpToolResult(refused).isError).toBe(true);
  });

  it('retries create_concert with confirm attach or create', async () => {
    const createConcert = vi.fn().mockResolvedValue({
      data: concert,
      error: null,
      outcome: CONCERT_IDENTITY.attached
    });
    await invokeLogTool(
      'create_concert',
      { artist: 'Justice', date: '2026-08-18', place: 'Paris', confirm: 'attach' },
      {},
      domainStub({ createConcert })
    );
    expect(createConcert.mock.calls[0]?.[1].confirm).toBe('attach');
  });

  it('list_events and list_attendance call the existing domain helpers', async () => {
    const listOwnedEvents = vi.fn().mockResolvedValue({ data: [eventRow], error: null });
    const listMyAttendance = vi.fn().mockResolvedValue({
      data: [{ id: 'a1', user_id: 'user-1', concert_id: 'concert-1', status: 'attended' }],
      error: null
    });

    const events = await invokeLogTool('list_events', {}, {}, domainStub({ listOwnedEvents }));
    const attendance = await invokeLogTool(
      'list_attendance',
      {},
      {},
      domainStub({ listMyAttendance })
    );

    expect(listOwnedEvents).toHaveBeenCalledTimes(1);
    expect(listMyAttendance).toHaveBeenCalledTimes(1);
    expect(events.ok).toBe(true);
    expect(attendance.data).toEqual([
      { id: 'a1', user_id: 'user-1', concert_id: 'concert-1', status: 'attended' }
    ]);
  });

  it('delete_event requires confirm for a non-empty Event and then calls domain delete', async () => {
    const getOwnedEvent = vi.fn().mockResolvedValue({ data: eventRow, error: null });
    const requireEventOwnerAccess = vi.fn().mockResolvedValue(null);
    const listConcertsForEvent = vi.fn().mockResolvedValue({ data: [concert], error: null });
    const eventHasJoiners = vi.fn().mockResolvedValue({ data: false, error: null });
    const deleteEvent = vi.fn().mockResolvedValue({ data: { id: eventRow.id }, error: null });
    const domain = domainStub({
      getOwnedEvent,
      requireEventOwnerAccess,
      listConcertsForEvent,
      eventHasJoiners,
      deleteEvent
    });

    const blocked = await invokeLogTool('delete_event', { eventId: eventRow.id }, {}, domain);
    expect(blocked.outcome).toBe(MCP_NEEDS_CONFIRM);
    expect(blocked.confirm).toBe(true);
    expect(deleteEvent).not.toHaveBeenCalled();

    const deleted = await invokeLogTool(
      'delete_event',
      { eventId: eventRow.id, confirm: true },
      {},
      domain
    );
    expect(deleted.ok).toBe(true);
    expect(deleteEvent).toHaveBeenCalledWith({}, eventRow.id);
  });

  it('move_concert requires confirm when joiners would lose the Concert and does not auto-join', async () => {
    const listOwnedConcerts = vi.fn().mockResolvedValue({ data: [concert], error: null });
    const requireEventOwnerAccess = vi.fn().mockResolvedValue(null);
    const concertMoveWouldLoseJoiners = vi.fn().mockResolvedValue({ data: true, error: null });
    const moveConcert = vi.fn().mockResolvedValue({
      data: { ...concert, event_id: 'event-2' },
      error: null
    });
    const domain = domainStub({
      listOwnedConcerts,
      requireEventOwnerAccess,
      concertMoveWouldLoseJoiners,
      moveConcert
    });

    const blocked = await invokeLogTool(
      'move_concert',
      { concertId: concert.id, targetEventId: 'event-2' },
      {},
      domain
    );
    expect(blocked.message).toBe(JOINER_IMPACT_COPY.moveConcert);
    expect(moveConcert).not.toHaveBeenCalled();

    const moved = await invokeLogTool(
      'move_concert',
      { concertId: concert.id, targetEventId: 'event-2', confirm: true },
      {},
      domain
    );
    expect(moved.ok).toBe(true);
    expect(concertMoveWouldLoseJoiners).toHaveBeenCalledWith({}, concert.event_id, 'event-2');
  });

  it('update_event and set_attendance call domain with the acting User client', async () => {
    const updateEvent = vi.fn().mockResolvedValue({ data: eventRow, error: null });
    const setAttendance = vi.fn().mockResolvedValue({
      data: { id: 'a1', user_id: 'user-1', concert_id: concert.id, status: 'going' },
      error: null
    });

    await invokeLogTool(
      'update_event',
      {
        eventId: eventRow.id,
        name: 'Club Night',
        startDate: '2026-08-18',
        place: 'Paris'
      },
      { marker: 'client' },
      domainStub({ updateEvent })
    );
    await invokeLogTool(
      'set_attendance',
      { concertId: concert.id, status: 'going' },
      { marker: 'client' },
      domainStub({ setAttendance })
    );

    expect(updateEvent.mock.calls[0]?.[0]).toEqual({ marker: 'client' });
    expect(setAttendance.mock.calls[0]?.[0]).toEqual({ marker: 'client' });
  });

  it('maps unknown tools without touching domain tables', async () => {
    const result = await invokeLogTool('invent_sql', {}, {}, domainStub({}));
    expect(result.ok).toBe(false);
    expect(result.ruleId).toBe('unknown_tool');
  });
});

describe('MCP joiner and membership tools', () => {
  const ownership = {
    ruleId: EVENT_RULE.ownership,
    message: EVENT_RULE_MESSAGE.ownership
  };

  it('join_event and leave_event call domain membership with the acting User client', async () => {
    const joinEvent = vi.fn().mockResolvedValue({
      data: { id: 'member-1', event_id: eventRow.id, user_id: 'joiner-1' },
      error: null
    });
    const leaveEvent = vi.fn().mockResolvedValue({ data: true, error: null });

    const joined = await invokeLogTool(
      'join_event',
      { eventId: eventRow.id },
      { marker: 'client' },
      domainStub({ joinEvent })
    );
    const left = await invokeLogTool(
      'leave_event',
      { eventId: eventRow.id },
      { marker: 'client' },
      domainStub({ leaveEvent })
    );

    expect(joinEvent).toHaveBeenCalledWith({ marker: 'client' }, eventRow.id);
    expect(leaveEvent).toHaveBeenCalledWith({ marker: 'client' }, eventRow.id);
    expect(joined.ok).toBe(true);
    expect(left.ok).toBe(true);
  });

  it('forwards domain ownership for joiner Bill writes and does not ask confirm', async () => {
    const createConcert = vi.fn().mockResolvedValue({
      data: null,
      error: ownership,
      outcome: null
    });
    const updateEvent = vi.fn().mockResolvedValue({ data: null, error: ownership });
    const requireEventOwnerAccess = vi.fn().mockResolvedValue(ownership);
    const deleteConcert = vi.fn();
    const moveConcert = vi.fn();
    const deleteEvent = vi.fn();
    const eventHasJoiners = vi.fn();
    const concertMoveWouldLoseJoiners = vi.fn();

    const created = await invokeLogTool(
      'create_concert',
      { artist: 'Justice', date: '2026-08-18', eventId: eventRow.id },
      {},
      domainStub({ createConcert })
    );
    expect(created.ok).toBe(false);
    expect(created.ruleId).toBe(EVENT_RULE.ownership);
    expect(created.message).toBe(EVENT_RULE_MESSAGE.ownership);

    const updated = await invokeLogTool(
      'update_event',
      {
        eventId: eventRow.id,
        name: 'Club Night',
        startDate: '2026-08-18',
        place: 'Paris'
      },
      {},
      domainStub({ updateEvent })
    );
    expect(updated.message).toBe(EVENT_RULE_MESSAGE.ownership);

    const deletedConcert = await invokeLogTool(
      'delete_concert',
      { concertId: concert.id, confirm: true },
      {},
      domainStub({
        listOwnedConcerts: vi.fn().mockResolvedValue({ data: [concert], error: null }),
        requireEventOwnerAccess,
        deleteConcert,
        eventHasJoiners
      })
    );
    expect(deletedConcert.message).toBe(EVENT_RULE_MESSAGE.ownership);
    expect(deletedConcert.outcome).not.toBe(MCP_NEEDS_CONFIRM);
    expect(deleteConcert).not.toHaveBeenCalled();
    expect(eventHasJoiners).not.toHaveBeenCalled();

    const moved = await invokeLogTool(
      'move_concert',
      { concertId: concert.id, targetEventId: 'event-2', confirm: true },
      {},
      domainStub({
        listOwnedConcerts: vi.fn().mockResolvedValue({ data: [concert], error: null }),
        requireEventOwnerAccess,
        moveConcert,
        concertMoveWouldLoseJoiners
      })
    );
    expect(moved.message).toBe(EVENT_RULE_MESSAGE.ownership);
    expect(moveConcert).not.toHaveBeenCalled();

    const deletedEvent = await invokeLogTool(
      'delete_event',
      { eventId: eventRow.id, confirm: true },
      {},
      domainStub({
        getOwnedEvent: vi.fn().mockResolvedValue({ data: eventRow, error: null }),
        requireEventOwnerAccess,
        deleteEvent,
        listConcertsForEvent: vi.fn(),
        eventHasJoiners
      })
    );
    expect(deletedEvent.message).toBe(EVENT_RULE_MESSAGE.ownership);
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it('lets a joiner set Attendance, attend this night, join, and leave', async () => {
    const setAttendance = vi.fn().mockResolvedValue({
      data: { id: 'a1', user_id: 'joiner-1', concert_id: concert.id, status: 'going' },
      error: null
    });
    const attendThisNight = vi.fn().mockResolvedValue({
      data: [{ id: 'a1', user_id: 'joiner-1', concert_id: concert.id, status: 'going' }],
      error: null
    });
    const joinEvent = vi.fn().mockResolvedValue({ data: true, error: null });
    const leaveEvent = vi.fn().mockResolvedValue({ data: true, error: null });

    const attendance = await invokeLogTool(
      'set_attendance',
      { concertId: concert.id, status: 'going' },
      {},
      domainStub({ setAttendance })
    );
    const attendAll = await invokeLogTool(
      'attend_this_night',
      { eventId: eventRow.id },
      {},
      domainStub({ attendThisNight })
    );
    const joined = await invokeLogTool(
      'join_event',
      { eventId: eventRow.id },
      {},
      domainStub({ joinEvent })
    );
    const left = await invokeLogTool(
      'leave_event',
      { eventId: eventRow.id },
      {},
      domainStub({ leaveEvent })
    );

    expect(attendance.ok).toBe(true);
    expect(attendAll.ok).toBe(true);
    expect(joined.ok).toBe(true);
    expect(left.ok).toBe(true);
  });

  it('list_attendance uses the domain effective-Attendance helper', async () => {
    const attendanceSource = read('shared/domain/attendance.ts');
    expect(attendanceSource).toMatch(/from\('attendance_effective'\)/);
    expect(read('server/utils/mcp-log-tools.ts')).toMatch(/listMyAttendance/);
    expect(read('server/utils/mcp-log-tools.ts')).not.toMatch(/from\('attendance_effective'\)/);
  });
});

describe('MCP adapter wiring', () => {
  it('binds Streamable HTTP, exchanges the personal key, and never queries domain tables with service_role', () => {
    const tools = read('server/utils/mcp-log-tools.ts');
    const server = read('server/utils/mcp-server.ts');
    const route = read('server/api/mcp/index.ts');
    const client = read('server/utils/mcp-user-client.ts');
    const auth = read('server/utils/mcp-auth.ts');
    const domain = liveMemoryLogDomain;

    expect(tools).toMatch(/createConcert/);
    expect(tools).toMatch(/updateConcert/);
    expect(tools).toMatch(/moveConcert/);
    expect(tools).toMatch(/deleteConcert/);
    expect(tools).toMatch(/createEvent/);
    expect(tools).toMatch(/updateEvent/);
    expect(tools).toMatch(/deleteEvent/);
    expect(tools).toMatch(/listOwnedEvents/);
    expect(tools).toMatch(/listMyAttendance/);
    expect(tools).toMatch(/setAttendance/);
    expect(tools).toMatch(/joinEvent/);
    expect(tools).toMatch(/leaveEvent/);
    expect(tools).toMatch(/requireEventOwnerAccess/);
    expect(tools).not.toMatch(/from\('events'\)/);
    expect(tools).not.toMatch(/from\('concerts'\)/);
    expect(tools).not.toMatch(/from\('attendance'\)/);
    expect(tools).not.toMatch(/from\('event_members'\)/);
    expect(tools).not.toMatch(/shared_list_concerts/);
    expect(tools).not.toMatch(/get_shared_list/);
    expect(tools).not.toMatch(/service_role/);
    expect(tools).toMatch(/value === 'attach' \|\| value === 'create'/);
    expect(tools).toMatch(/CONCERT_IDENTITY\.needsChoice/);
    expect(EVENT_RULE_MESSAGE.ownership).toMatch(/own this Event/);

    expect(server).toMatch(/@modelcontextprotocol\/sdk\/server\/mcp/);
    expect(server).toMatch(/invokeLogTool/);
    expect(server).toMatch(/create_concert/);
    expect(server).toMatch(/join_event/);
    expect(server).toMatch(/leave_event/);
    expect(server).toMatch(/confirmChoiceSchema/);
    expect(server).not.toMatch(/from\('events'\)/);
    expect(server).not.toMatch(/service_role/);

    expect(route).toMatch(/WebStandardStreamableHTTPServerTransport/);
    expect(route).toMatch(/sessionIdGenerator: undefined/);
    expect(route).toMatch(/enableJsonResponse: true/);
    expect(route).toMatch(/exchangePersonalKey/);
    expect(route).toMatch(/createUserScopedClient/);
    expect(route).toMatch(/createLiveMemoryMcpServer/);
    expect(route).toMatch(/MCP_KEY_HEADER/);
    expect(auth).toMatch(/x-livememory-key/);
    expect(route).not.toMatch(/from\('events'\)/);
    expect(route).not.toMatch(/from\('concerts'\)/);
    expect(route).not.toMatch(/\/rest\/v1\/events/);
    expect(route).not.toMatch(/serviceRoleKey.*from\('/);

    expect(client).toMatch(/createClient/);
    expect(client).toMatch(/env\.anonKey/);
    expect(client).toMatch(/Authorization: `Bearer \$\{accessToken\}`/);
    expect(client).not.toMatch(/serviceRoleKey/);
    expect(client).not.toMatch(/service_role/);

    expect(domain.createConcert).toBeTypeOf('function');
    expect(domain.listMyAttendance).toBeTypeOf('function');
    expect(domain.joinEvent).toBeTypeOf('function');
    expect(domain.leaveEvent).toBeTypeOf('function');
    expect(domain.requireEventOwnerAccess).toBeTypeOf('function');
  });

  it('keeps prerender of / independent of the MCP SDK', () => {
    const config = read('nuxt.config.ts');
    expect(config).toMatch(/'\/': \{ prerender: true \}/);
    expect(config).not.toMatch(/modelcontextprotocol/);
    expect(config).not.toMatch(/public:[\s\S]*supabaseServiceRoleKey/);
  });
});

describe('MCP Cursor OAuth discovery probes', () => {
  it('returns 404 for OAuth well-known paths so Cursor uses Authorization headers', () => {
    const middleware = read('server/middleware/00-no-oauth-discovery.ts');
    const config = read('nuxt.config.ts');

    expect(middleware).toMatch(/\.well-known\/oauth/);
    expect(middleware).toMatch(/setResponseStatus\(event, 404\)/);
    expect(config).toMatch(/'\/\.well-known\/\*\*'/);
    expect(config).toMatch(/'\/api\/\*\*'/);
  });
});

describe('MCP tool JSON envelope', () => {
  it('does not mark needs_choice as a generic tool error', () => {
    const json: McpToolJson = {
      ok: false,
      outcome: CONCERT_IDENTITY.needsChoice,
      confirm: ['attach', 'create']
    };
    expect(toMcpToolResult(json).isError).toBe(false);
  });
});
