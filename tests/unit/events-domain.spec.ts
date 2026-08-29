import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createEvent,
  deleteEvent,
  getOwnedEvent,
  listOwnedEvents,
  selectFeaturedEvents,
  updateEvent,
  EVENT_RULE,
  EVENT_RULE_MESSAGE,
  dateOutsideEventMessage,
  type EventBillConcert,
  type EventMemberRecord,
  type EventRecord,
  type EventStageRecord,
  type EventsClient
} from '../../shared/domain/events';

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

const readMigrations = () => {
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql'))
    .sort();

  return files.map(name => ({
    name,
    sql: readFileSync(resolve(migrationsDir, name), 'utf8')
  }));
};

const festivalRow: EventRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  owner_id: 'owner-1',
  kind: 'festival',
  name: 'Rock Week',
  start_date: '2026-08-20',
  end_date: '2026-08-22',
  place: 'Paris'
};

const createMockEventsClient = (options?: {
  rows?: EventRecord[];
  concerts?: EventBillConcert[];
  stages?: EventStageRecord[];
  insertCalls?: Record<string, unknown>[];
  updateCalls?: Record<string, unknown>[];
  rpcCalls?: Record<string, unknown>[];
  eventDeletes?: { column: string; value: string }[];
  getError?: { message: string; code?: string };
  insertError?: { message: string; code?: string; details?: string; hint?: string };
  updateError?: { message: string; code?: string; details?: string; hint?: string };
  rpcError?: { message: string; code?: string; details?: string; hint?: string };
  deleteError?: { message: string; code?: string; details?: string; hint?: string };
  members?: EventMemberRecord[];
}) => {
  const rows = [...(options?.rows ?? [])];
  const concerts = [...(options?.concerts ?? [])];
  const stages = [...(options?.stages ?? [])];
  const members = [...(options?.members ?? [])];
  const insertCalls = options?.insertCalls ?? [];
  const updateCalls = options?.updateCalls ?? [];
  const rpcCalls = options?.rpcCalls ?? [];
  const eventDeletes = options?.eventDeletes ?? [];

  const client = {
    from: (table: 'events' | 'concerts' | 'event_stages' | 'event_members') => {
      if (table === 'event_members') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: null, error: { message: 'Event not found' } })
            })
          }),
          select: () => ({
            order: async () => ({ data: members, error: null }),
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: members.find(member => member.event_id === value || member.id === value) ?? null,
                error: null
              }),
              order: async () => ({ data: [], error: null }),
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
                order: async () => ({ data: [], error: null })
              }),
              in: async () => ({ data: [], error: null })
            })
          })
        };
      }

      if (table === 'concerts') {
        return {
          select: () => ({
            order: async () => ({ data: concerts, error: null }),
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: concerts.find(concert => concert.id === value) ?? null,
                error: null
              }),
              order: async () => ({
                data: concerts.filter(concert => concert.event_id === value),
                error: null
              }),
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
                order: async () => ({ data: [], error: null })
              })
            })
          }),
          update: (row: Record<string, unknown>) => ({
            eq: (column: string, value: string) => ({
              select: () => ({
                single: async () => {
                  const index = concerts.findIndex(concert => concert[column as keyof EventBillConcert] === value);
                  if (index < 0) {
                    return { data: null, error: { message: 'concert not found' } };
                  }

                  const updated = {
                    ...concerts[index]!,
                    date: row.date === undefined ? concerts[index]!.date : String(row.date),
                    place: row.place === undefined ? concerts[index]!.place : String(row.place),
                    stage_id: row.stage_id === undefined
                      ? concerts[index]!.stage_id
                      : (row.stage_id == null ? null : String(row.stage_id))
                  };
                  concerts[index] = updated;
                  return { data: updated, error: null };
                }
              })
            })
          })
        };
      }

      if (table === 'event_stages') {
        return {
          select: () => ({
            order: async () => ({ data: stages, error: null }),
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: stages.find(stage => stage.id === value || stage.event_id === value) ?? null,
                error: null
              }),
              order: async () => ({
                data: stages.filter(stage => stage.event_id === value),
                error: null
              })
            })
          }),
          insert: (row: Record<string, unknown>) => {
            const created: EventStageRecord = {
              id: String(row.id ?? `stage-${stages.length + 1}`),
              event_id: String(row.event_id),
              name: String(row.name)
            };
            stages.push(created);
            return {
              select: () => ({
                single: async () => ({ data: created, error: null })
              })
            };
          },
          update: (row: Record<string, unknown>) => ({
            eq: (column: string, value: string) => ({
              select: () => ({
                single: async () => {
                  const index = stages.findIndex(stage => stage[column as keyof EventStageRecord] === value);
                  if (index < 0) {
                    return { data: null, error: { message: 'stage not found' } };
                  }

                  const updated = {
                    ...stages[index]!,
                    name: row.name === undefined ? stages[index]!.name : String(row.name)
                  };
                  stages[index] = updated;
                  return { data: updated, error: null };
                }
              })
            })
          }),
          delete: () => ({
            eq: async (column: string, value: string) => {
              const index = stages.findIndex(stage => stage[column as keyof EventStageRecord] === value);
              if (index >= 0) {
                stages.splice(index, 1);
              }
              return { data: null, error: null };
            }
          })
        };
      }

      return {
        insert: (row: Record<string, unknown>) => {
          insertCalls.push(row);
          return {
            select: () => ({
              single: async () => {
                if (options?.insertError) {
                  return { data: null, error: options.insertError };
                }

                const created: EventRecord = {
                  id: '22222222-2222-4222-8222-222222222222',
                  owner_id: 'owner-1',
                  kind: row.kind as EventRecord['kind'],
                  name: String(row.name),
                  start_date: String(row.start_date),
                  end_date: String(row.end_date),
                  place: String(row.place),
                  allow_place_override: row.allow_place_override === true
                };
                rows.push(created);
                return { data: created, error: null };
              }
            })
          };
        },
        select: () => ({
          order: async () => ({ data: rows, error: null }),
          eq: (_column: string, value: string) => ({
            maybeSingle: async () => {
              if (options?.getError) {
                return { data: null, error: options.getError };
              }

              return {
                data: rows.find(row => row.id === value) ?? null,
                error: null
              };
            },
            order: async () => ({
              data: rows.filter(row => row.id === value),
              error: null
            })
          })
        }),
        update: (row: Record<string, unknown>) => {
          updateCalls.push(row);
          return {
            eq: (column: string, value: string) => ({
              select: () => ({
                single: async () => {
                  if (options?.updateError) {
                    return { data: null, error: options.updateError };
                  }

                  const index = rows.findIndex(event => event[column as keyof EventRecord] === value);
                  if (index < 0) {
                    return { data: null, error: { message: 'event not found' } };
                  }

                  const updated: EventRecord = {
                    ...rows[index]!,
                    name: row.name === undefined ? rows[index]!.name : String(row.name),
                    start_date: row.start_date === undefined ? rows[index]!.start_date : String(row.start_date),
                    end_date: row.end_date === undefined ? rows[index]!.end_date : String(row.end_date),
                    place: row.place === undefined ? rows[index]!.place : String(row.place),
                    allow_place_override: row.allow_place_override === undefined
                      ? rows[index]!.allow_place_override
                      : row.allow_place_override === true
                  };
                  rows[index] = updated;
                  return { data: updated, error: null };
                }
              })
            })
          };
        },
        delete: () => ({
          eq: async (column: string, value: string) => {
            eventDeletes.push({ column, value });
            if (options?.deleteError) {
              return { data: null, error: options.deleteError };
            }

            const index = rows.findIndex(event => event[column as keyof EventRecord] === value);
            if (index >= 0) {
              const eventId = rows[index]!.id;
              rows.splice(index, 1);
              for (let concertIndex = concerts.length - 1; concertIndex >= 0; concertIndex -= 1) {
                if (concerts[concertIndex]?.event_id === eventId) {
                  concerts.splice(concertIndex, 1);
                }
              }
              for (let stageIndex = stages.length - 1; stageIndex >= 0; stageIndex -= 1) {
                if (stages[stageIndex]?.event_id === eventId) {
                  stages.splice(stageIndex, 1);
                }
              }
            }

            return { data: null, error: null };
          }
        })
      };
    },
    rpc: async (
      fn: 'save_event_and_concert_dates',
      args: {
        p_event_id: string;
        p_start_date: string;
        p_end_date: string;
        p_concert_dates: Array<{ id: string; date?: string; stage_id?: string | null }> | null;
        p_name?: string;
        p_place?: string;
        p_allow_place_override?: boolean;
        p_stages?: Array<{ id: string; name: string }> | null;
      }
    ) => {
      rpcCalls.push({ fn, ...args });
      if (options?.rpcError) {
        return { data: null, error: options.rpcError };
      }

      const index = rows.findIndex(event => event.id === args.p_event_id);
      if (index < 0) {
        return { data: null, error: { message: 'You do not own this Event.' } };
      }

      const updated: EventRecord = {
        ...rows[index]!,
        start_date: args.p_start_date,
        end_date: args.p_end_date,
        name: args.p_name ?? rows[index]!.name,
        place: args.p_place ?? rows[index]!.place,
        allow_place_override: args.p_allow_place_override ?? rows[index]!.allow_place_override
      };
      rows[index] = updated;

      if (args.p_concert_dates) {
        for (const patch of args.p_concert_dates) {
          const concertIndex = concerts.findIndex(concert => concert.id === patch.id);
          if (concertIndex >= 0) {
            concerts[concertIndex] = {
              ...concerts[concertIndex]!,
              date: patch.date ?? concerts[concertIndex]!.date,
              stage_id: patch.stage_id === undefined ? concerts[concertIndex]!.stage_id : patch.stage_id
            };
          }
        }
      }

      if (args.p_stages) {
        const kept = new Set(args.p_stages.map(stage => stage.id));
        for (let stageIndex = stages.length - 1; stageIndex >= 0; stageIndex -= 1) {
          if (stages[stageIndex]?.event_id === args.p_event_id && !kept.has(stages[stageIndex]!.id)) {
            stages.splice(stageIndex, 1);
          }
        }
        for (const stage of args.p_stages) {
          const existingIndex = stages.findIndex(row => row.id === stage.id);
          const next: EventStageRecord = {
            id: stage.id,
            event_id: args.p_event_id,
            name: stage.name
          };
          if (existingIndex >= 0) {
            stages[existingIndex] = next;
          } else {
            stages.push(next);
          }
        }
      }

      return { data: updated, error: null };
    }
  };

  return { client: client as unknown as EventsClient, rows, concerts, stages, insertCalls, updateCalls, rpcCalls, eventDeletes };
};

describe('events migration kernel', () => {
  it('adds events with kind check, inclusive date check, and owner RLS', () => {
    const eventsMigration = readMigrations().find(file => file.name.includes('events'));

    expect(eventsMigration).toBeTruthy();
    const sql = eventsMigration?.sql ?? '';

    expect(sql).toMatch(/create table public\.events/);
    expect(sql).toMatch(/single_night/);
    expect(sql).toMatch(/festival/);
    expect(sql).toMatch(/end_date\s*>=\s*start_date/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/owner_id/);
    expect(sql).toMatch(/\(select auth\.uid\(\)\)/);
    expect(sql).not.toMatch(/service_role/);
  });

  it('lets the owner delete an Event and cascades Concerts, Attendance, and notes', () => {
    const deleteMigration = readMigrations().find(file => file.name.includes('events_owner_delete'));
    expect(deleteMigration).toBeTruthy();
    const deleteSql = deleteMigration?.sql ?? '';
    expect(deleteSql).toMatch(/grant delete on table public\.events to authenticated/);
    expect(deleteSql).toMatch(/for delete/);
    expect(deleteSql).toMatch(/\(select auth\.uid\(\)\)\s*=\s*owner_id/);
    expect(deleteSql).not.toMatch(/service_role/);

    const allSql = readMigrations().map(file => file.sql).join('\n');
    expect(allSql).toMatch(/event_id uuid not null references public\.events \(id\) on delete cascade/);
    expect(allSql).toMatch(/concert_id uuid not null references public\.concerts \(id\) on delete cascade/);
    expect(allSql).toMatch(/add column notes text/);
    expect(allSql).not.toMatch(/event_id uuid null/);
  });
});

describe('createEvent', () => {
  it('creates a festival with name, inclusive dates, and Place', async () => {
    const { client, insertCalls } = createMockEventsClient();

    const result = await createEvent(client, {
      kind: 'festival',
      name: '  Rock Week  ',
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      place: '  Paris  '
    });

    expect(result.error).toBeNull();
    expect(result.data?.kind).toBe('festival');
    expect(result.data?.name).toBe('Rock Week');
    expect(result.data?.start_date).toBe('2026-08-20');
    expect(result.data?.end_date).toBe('2026-08-22');
    expect(result.data?.place).toBe('Paris');
    expect(result.data?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(insertCalls[0]).toMatchObject({
      kind: 'festival',
      name: 'Rock Week',
      start_date: '2026-08-20',
      end_date: '2026-08-22',
      place: 'Paris'
    });
  });

  it('creates a single_night with the same start and end date even if the client sends a different end', async () => {
    const { client, insertCalls } = createMockEventsClient();

    const result = await createEvent(client, {
      kind: 'single_night',
      name: 'Club Night',
      startDate: '2026-08-18',
      endDate: '2026-08-19',
      place: 'Berlin'
    });

    expect(result.error).toBeNull();
    expect(result.data?.kind).toBe('single_night');
    expect(result.data?.start_date).toBe('2026-08-18');
    expect(result.data?.end_date).toBe('2026-08-18');
    expect(insertCalls[0]).toMatchObject({
      kind: 'single_night',
      start_date: '2026-08-18',
      end_date: '2026-08-18'
    });
  });

  it('rejects inverted festival dates with a named date-rule error and does not insert', async () => {
    const { client, insertCalls } = createMockEventsClient();

    const result = await createEvent(client, {
      kind: 'festival',
      name: 'Rock Week',
      startDate: '2026-08-22',
      endDate: '2026-08-20',
      place: 'Paris'
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(EVENT_RULE.dateOrder);
    expect(result.error?.message).toBe(EVENT_RULE_MESSAGE.dateOrder);
    expect(EVENT_RULE_MESSAGE.dateOrder.toLowerCase()).toMatch(/end date[\s\S]*start date|start date[\s\S]*end date/);
    expect(insertCalls).toHaveLength(0);
  });

  it('rejects a missing name or Place with a named required-field error and does not insert', async () => {
    const { client, insertCalls } = createMockEventsClient();

    const missingName = await createEvent(client, {
      kind: 'festival',
      name: '  ',
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      place: 'Paris'
    });

    expect(missingName.data).toBeNull();
    expect(missingName.error?.ruleId).toBe(EVENT_RULE.requiredName);
    expect(missingName.error?.message).toBe(EVENT_RULE_MESSAGE.requiredName);

    const missingPlace = await createEvent(client, {
      kind: 'single_night',
      name: 'Club Night',
      startDate: '2026-08-18',
      place: ''
    });

    expect(missingPlace.data).toBeNull();
    expect(missingPlace.error?.ruleId).toBe(EVENT_RULE.requiredPlace);
    expect(missingPlace.error?.message).toBe(EVENT_RULE_MESSAGE.requiredPlace);
    expect(insertCalls).toHaveLength(0);
  });

  it('rejects a missing night date or festival end date and does not insert', async () => {
    const { client, insertCalls } = createMockEventsClient();

    const missingNightDate = await createEvent(client, {
      kind: 'single_night',
      name: 'Club Night',
      startDate: '',
      place: 'Berlin'
    });

    expect(missingNightDate.data).toBeNull();
    expect(missingNightDate.error?.ruleId).toBe(EVENT_RULE.requiredStartDate);
    expect(missingNightDate.error?.message).toBe(EVENT_RULE_MESSAGE.requiredDate);

    const missingFestivalEnd = await createEvent(client, {
      kind: 'festival',
      name: 'Rock Week',
      startDate: '2026-08-20',
      endDate: '',
      place: 'Paris'
    });

    expect(missingFestivalEnd.data).toBeNull();
    expect(missingFestivalEnd.error?.ruleId).toBe(EVENT_RULE.requiredEndDate);
    expect(missingFestivalEnd.error?.message).toBe(EVENT_RULE_MESSAGE.requiredEndDate);
    expect(insertCalls).toHaveLength(0);
  });

  it('maps only events_dates_check violations to the date-order rule', async () => {
    const datesCheck = createMockEventsClient({
      insertError: {
        code: '23514',
        message: 'new row for relation "events" violates check constraint "events_dates_check"'
      }
    });
    const datesResult = await createEvent(datesCheck.client, {
      kind: 'festival',
      name: 'Rock Week',
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      place: 'Paris'
    });
    expect(datesResult.data).toBeNull();
    expect(datesResult.error?.ruleId).toBe(EVENT_RULE.dateOrder);
    expect(datesResult.error?.message).toBe(EVENT_RULE_MESSAGE.dateOrder);

    const kindCheck = createMockEventsClient({
      insertError: {
        code: '23514',
        message: 'new row for relation "events" violates check constraint "events_kind_check"'
      }
    });
    const kindResult = await createEvent(kindCheck.client, {
      kind: 'festival',
      name: 'Rock Week',
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      place: 'Paris'
    });
    expect(kindResult.data).toBeNull();
    expect(kindResult.error?.ruleId).toBe('persist_failed');
    expect(kindResult.error?.message).toMatch(/events_kind_check/);

    const looseMessage = createMockEventsClient({
      insertError: {
        code: '23514',
        message: 'end_date is invalid'
      }
    });
    const looseResult = await createEvent(looseMessage.client, {
      kind: 'festival',
      name: 'Rock Week',
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      place: 'Paris'
    });
    expect(looseResult.error?.ruleId).toBe('persist_failed');
  });
});

describe('listOwnedEvents and getOwnedEvent', () => {
  it('lists upcoming then past by start date and gets an owned Event by id', async () => {
    const past: EventRecord = {
      ...festivalRow,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Past Fest',
      start_date: '2026-08-01',
      end_date: '2026-08-02'
    };
    const upcoming: EventRecord = {
      ...festivalRow,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Next Fest',
      start_date: '2026-08-20',
      end_date: '2026-08-21'
    };
    const later: EventRecord = {
      ...festivalRow,
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      name: 'Later Fest',
      start_date: '2026-08-25',
      end_date: '2026-08-26'
    };

    const { client } = createMockEventsClient({
      rows: [past, later, upcoming]
    });

    const listed = await listOwnedEvents(client, { now: new Date('2026-08-18T12:00:00Z') });

    expect(listed.error).toBeNull();
    expect(listed.data?.map(event => event.name)).toEqual(['Next Fest', 'Later Fest', 'Past Fest']);

    const found = await getOwnedEvent(client, upcoming.id);
    expect(found.error).toBeNull();
    expect(found.data?.id).toBe(upcoming.id);

    const missing = await getOwnedEvent(client, '00000000-0000-4000-8000-000000000000');
    expect(missing.data).toBeNull();
    expect(missing.error).toBeNull();
  });

  it('treats a malformed UUID as quiet not-found and surfaces other get errors', async () => {
    const malformed = createMockEventsClient({
      getError: { code: '22P02', message: 'invalid input syntax for type uuid' }
    });
    const malformedResult = await getOwnedEvent(malformed.client, 'not-a-uuid');
    expect(malformedResult.data).toBeNull();
    expect(malformedResult.error).toBeNull();

    const failed = createMockEventsClient({
      getError: { code: '57014', message: 'canceling statement due to statement timeout' }
    });
    const failedResult = await getOwnedEvent(failed.client, festivalRow.id);
    expect(failedResult.data).toBeNull();
    expect(failedResult.error?.ruleId).toBe('get_failed');
  });
});

describe('deleteEvent', () => {
  const nightConcert: EventBillConcert = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    event_id: festivalRow.id,
    artist: 'Justice',
    date: '2026-08-20',
    place: 'Paris',
    stage_id: null
  };

  it('deletes an empty Event without touching Concerts', async () => {
    const { client, rows, concerts, eventDeletes } = createMockEventsClient({
      rows: [festivalRow]
    });

    const result = await deleteEvent(client, festivalRow.id);

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(festivalRow.id);
    expect(rows).toHaveLength(0);
    expect(concerts).toHaveLength(0);
    expect(eventDeletes).toEqual([{ column: 'id', value: festivalRow.id }]);
  });

  it('deletes a non-empty Event and leaves no Concert without an Event', async () => {
    const sibling: EventRecord = {
      ...festivalRow,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Other Night'
    };
    const siblingConcert: EventBillConcert = {
      ...nightConcert,
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      event_id: sibling.id
    };
    const { client, rows, concerts, eventDeletes } = createMockEventsClient({
      rows: [festivalRow, sibling],
      concerts: [nightConcert, siblingConcert]
    });

    const result = await deleteEvent(client, festivalRow.id);

    expect(result.error).toBeNull();
    expect(rows.map(event => event.id)).toEqual([sibling.id]);
    expect(concerts.map(concert => concert.id)).toEqual([siblingConcert.id]);
    expect(concerts.every(concert => rows.some(event => event.id === concert.event_id))).toBe(true);
    expect(eventDeletes).toEqual([{ column: 'id', value: festivalRow.id }]);
  });

  it('blocks delete when the Event is missing or not owned', async () => {
    const { client, rows, eventDeletes } = createMockEventsClient({
      rows: [festivalRow]
    });

    const missing = await deleteEvent(client, '00000000-0000-4000-8000-000000000000');
    expect(missing.data).toBeNull();
    expect(missing.error?.ruleId).toBe(EVENT_RULE.ownership);
    expect(missing.error?.message).toBe(EVENT_RULE_MESSAGE.ownership);
    expect(rows).toHaveLength(1);
    expect(eventDeletes).toHaveLength(0);

    const blank = await deleteEvent(client, '  ');
    expect(blank.error?.ruleId).toBe(EVENT_RULE.ownership);
    expect(eventDeletes).toHaveLength(0);
  });

  it('blocks Event update and delete when the acting User is a member', async () => {
    const membership: EventMemberRecord = {
      id: 'mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm',
      event_id: festivalRow.id,
      user_id: 'joiner-1'
    };
    const { client, updateCalls, eventDeletes, rows } = createMockEventsClient({
      rows: [festivalRow],
      members: [membership]
    });

    const updated = await updateEvent(client, {
      eventId: festivalRow.id,
      name: 'Stolen Week',
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      place: 'Paris'
    });
    expect(updated.data).toBeNull();
    expect(updated.error?.ruleId).toBe(EVENT_RULE.ownership);
    expect(updated.error?.message).toBe(EVENT_RULE_MESSAGE.ownership);
    expect(updateCalls).toHaveLength(0);
    expect(rows[0]?.name).toBe(festivalRow.name);

    const deleted = await deleteEvent(client, festivalRow.id);
    expect(deleted.data).toBeNull();
    expect(deleted.error?.ruleId).toBe(EVENT_RULE.ownership);
    expect(eventDeletes).toHaveLength(0);
    expect(rows).toHaveLength(1);
  });

  it('surfaces persist failures from Event delete', async () => {
    const { client, rows, eventDeletes } = createMockEventsClient({
      rows: [festivalRow],
      deleteError: { message: 'delete denied' }
    });

    const result = await deleteEvent(client, festivalRow.id);

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe('persist_failed');
    expect(result.error?.message).toBe('delete denied');
    expect(rows).toHaveLength(1);
    expect(eventDeletes).toEqual([{ column: 'id', value: festivalRow.id }]);
  });
});

describe('events store and pages use domain helpers only', () => {
  it('keeps Event queries in shared/domain and out of pages and the store', () => {
    const store = readFileSync(resolve(process.cwd(), 'app/stores/events.ts'), 'utf8');
    expect(store).toMatch(/from '#shared\/domain\/events'/);
    expect(store).toMatch(/createEvent|listOwnedEvents|getOwnedEvent|updateEvent|deleteEvent/);
    expect(store).toMatch(/deleteOwnedEvent/);
    expect(store).not.toMatch(/from\('events'\)/);
    expect(store).toMatch(/\{ data, error \}|return \{[\s\S]*data:[\s\S]*error:/);
    expect(store).toMatch(/finally/);

    const pageFiles = [
      'app/pages/concerts.vue',
      'app/pages/e/[id].vue',
      'app/pages/home.vue',
      'app/components/AppEventCard.vue'
    ];

    for (const file of pageFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/from\('events'\)/);
      expect(source).not.toMatch(/shared\/domain/);
    }

    expect(readFileSync(resolve(process.cwd(), 'app/pages/concerts.vue'), 'utf8')).toMatch(/useEventsStore/);
    expect(readFileSync(resolve(process.cwd(), 'app/pages/concerts.vue'), 'utf8')).not.toMatch(/New night/);
    expect(readFileSync(resolve(process.cwd(), 'app/pages/concerts.vue'), 'utf8')).not.toMatch(/New festival/);
    expect(readFileSync(resolve(process.cwd(), 'app/pages/concerts.vue'), 'utf8')).toMatch(/openSheet/);
    const eventPage = readFileSync(resolve(process.cwd(), 'app/pages/e/[id].vue'), 'utf8');
    expect(eventPage).toMatch(/useEventsStore/);
    expect(eventPage).toMatch(/middleware:\s*'auth'/);
    expect(eventPage).toMatch(/AppListSkeleton/);
    expect(eventPage).toMatch(/AppLoadError/);
    expect(eventPage).toMatch(/Event not found/);
    expect(eventPage).toMatch(/loadFailed|eventsStore\.error|error\.value/);
    expect(eventPage).toMatch(/Edit event/);

    expect(readFileSync(resolve(process.cwd(), 'app/app.vue'), 'utf8')).toMatch(/home\|concerts\|profile\|e/);
    expect(readFileSync(resolve(process.cwd(), 'app/app.vue'), 'utf8')).toMatch(/AppEditEventSheet/);
    expect(readFileSync(resolve(process.cwd(), 'app/components/AppEditEventSheet.vue'), 'utf8')).toMatch(/updateOwnedEvent/);
    expect(readFileSync(resolve(process.cwd(), 'app/components/AppEditEventSheet.vue'), 'utf8')).toMatch(/deleteOwnedEvent/);
    expect(readFileSync(resolve(process.cwd(), 'app/components/AppEditEventSheet.vue'), 'utf8')).toMatch(/concertDates/);
    expect(readFileSync(resolve(process.cwd(), 'app/components/AppEditEventSheet.vue'), 'utf8')).toMatch(/concertStages/);
    expect(readFileSync(resolve(process.cwd(), 'app/components/AppEditEventSheet.vue'), 'utf8')).not.toMatch(/firstStage/);
    const sheet = readFileSync(resolve(process.cwd(), 'app/components/AppEditEventSheet.vue'), 'utf8');
    expect(sheet).toMatch(/if \(!hasConcerts\.value && !deleteHasJoiners\.value\)/);
    expect(sheet).toMatch(/confirmDelete/);
    expect(sheet).toMatch(/This Event and all its Concerts will be deleted/);
    expect(sheet).toMatch(/JOINER_IMPACT_COPY/);
    expect(sheet).toMatch(/eventHasJoiners/);
    expect(sheet).toMatch(/deleteHasJoiners/);
    expect(sheet).toMatch(/Delete event/);
    expect(sheet).toMatch(/navigateTo\('\/concerts'\)/);
    expect(sheet).not.toMatch(/keep-standalone|standalone/);
  });
});

describe('selectFeaturedEvents', () => {
  const eventAt = (id: string, name: string, start: string, end = start): EventRecord => ({
    ...festivalRow,
    id,
    name,
    start_date: start,
    end_date: end,
    place: 'Paris'
  });

  it('ranks the next 1–3 upcoming owned Events by start date, including empty ones', () => {
    const past = eventAt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Past Night', '2026-08-01');
    const emptySoon = eventAt('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Empty Soon', '2026-08-20');
    const second = eventAt('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Second', '2026-08-21');
    const third = eventAt('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Third', '2026-08-22');
    const fourth = eventAt('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Fourth', '2026-08-23');
    const now = new Date('2026-08-19T12:00:00Z');

    expect(selectFeaturedEvents([fourth, past, third, emptySoon, second], now).map(event => event.name)).toEqual([
      'Empty Soon',
      'Second',
      'Third'
    ]);
    expect(selectFeaturedEvents([past], now)).toEqual([]);
    expect(selectFeaturedEvents([emptySoon], now).map(event => event.name)).toEqual(['Empty Soon']);
  });
});

describe('event rules kernel', () => {
  it('adds stages, place override default off, concert stage_id, and a SECURITY INVOKER combined date save', () => {
    const migration = readMigrations().find(file => file.name.includes('event_rules_stages_place_override'));
    expect(migration).toBeTruthy();
    const sql = migration?.sql ?? '';

    expect(sql).toMatch(/create table public\.event_stages/);
    expect(sql).toMatch(/allow_place_override boolean not null default false/);
    expect(sql).toMatch(/add column stage_id uuid/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/\(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/btrim\(concerts\.artist\) <> ''/);
    expect(sql).toMatch(/save_event_and_concert_dates/);
    expect(sql).toMatch(/security invoker/);
    expect(sql).toMatch(/deferrable initially deferred/);
    expect(sql).not.toMatch(/service_role/);
    expect(sql).not.toMatch(/security definer/i);
  });

  it('validates both source and destination Events when a Stage event_id changes', () => {
    const migration = readMigrations().find(file => file.name.includes('event_rules_stages_place_override'));
    const sql = migration?.sql ?? '';
    const triggerFn = sql.slice(
      sql.indexOf('create or replace function public.enforce_event_stages_bill_rules()'),
      sql.indexOf('create constraint trigger event_stages_bill_rules')
    );

    expect(triggerFn).toMatch(/old\.event_id is distinct from new\.event_id/);
    expect(triggerFn).toMatch(/stage_id = old\.id/);
    expect(triggerFn).toMatch(/assert_event_bill_valid\(old\.event_id\)/);
    expect(triggerFn).toMatch(/assert_event_bill_valid\(new\.event_id\)/);
    expect(triggerFn).toMatch(/Stage or Scene must be on this Event/);
  });
});

describe('updateEvent', () => {
  const justice: EventBillConcert = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    event_id: festivalRow.id,
    artist: 'Justice',
    date: '2026-08-20',
    place: 'Paris',
    stage_id: null
  };

  const phoenix: EventBillConcert = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    event_id: festivalRow.id,
    artist: 'Phoenix',
    date: '2026-08-21',
    place: 'Paris',
    stage_id: null
  };

  it('saves name, Place, and Place-override defaulting off without RPC', async () => {
    const { client, updateCalls, rpcCalls } = createMockEventsClient({
      rows: [{ ...festivalRow, allow_place_override: false }]
    });

    const result = await updateEvent(client, {
      eventId: festivalRow.id,
      name: 'Rock Week Paris',
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      place: 'La Villette',
      allowPlaceOverride: false
    });

    expect(result.error).toBeNull();
    expect(result.data?.name).toBe('Rock Week Paris');
    expect(result.data?.place).toBe('La Villette');
    expect(result.data?.allow_place_override).toBe(false);
    expect(updateCalls[0]).toMatchObject({
      name: 'Rock Week Paris',
      place: 'La Villette',
      allow_place_override: false
    });
    expect(rpcCalls).toHaveLength(0);
  });

  it('blocks an Event date change that would invalidate Concerts and lists each Concert and failed rule', async () => {
    const { client, updateCalls, rpcCalls } = createMockEventsClient({
      rows: [festivalRow],
      concerts: [justice, phoenix]
    });

    const result = await updateEvent(client, {
      eventId: festivalRow.id,
      name: festivalRow.name,
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      place: festivalRow.place
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(EVENT_RULE.concertConflict);
    expect(result.error?.message).toContain(EVENT_RULE_MESSAGE.concertConflict);
    expect(result.error?.message).toContain('Justice (20/08/2026)');
    expect(result.error?.message).toContain('Phoenix (21/08/2026)');
    expect(result.error?.message).toContain(dateOutsideEventMessage({
      start_date: '2026-08-10',
      end_date: '2026-08-12'
    }));
    expect(result.error?.conflicts).toHaveLength(2);
    expect(updateCalls).toHaveLength(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it('saves Event dates and Concert dates together in one domain operation', async () => {
    const { client, rpcCalls, concerts } = createMockEventsClient({
      rows: [festivalRow],
      concerts: [justice, phoenix]
    });

    const result = await updateEvent(client, {
      eventId: festivalRow.id,
      name: festivalRow.name,
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      place: festivalRow.place,
      concertDates: [
        { concertId: justice.id, date: '2026-08-10' },
        { concertId: phoenix.id, date: '2026-08-11' }
      ]
    });

    expect(result.error).toBeNull();
    expect(result.data?.start_date).toBe('2026-08-10');
    expect(result.data?.end_date).toBe('2026-08-12');
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]).toMatchObject({
      fn: 'save_event_and_concert_dates',
      p_event_id: festivalRow.id,
      p_start_date: '2026-08-10',
      p_end_date: '2026-08-12'
    });
    expect(concerts.map(concert => concert.date)).toEqual(['2026-08-10', '2026-08-11']);
  });

  it('allows adding a Stage list without assigning existing Concerts', async () => {
    const { client, rpcCalls, concerts } = createMockEventsClient({
      rows: [festivalRow],
      concerts: [justice, phoenix]
    });

    const result = await updateEvent(client, {
      eventId: festivalRow.id,
      name: festivalRow.name,
      startDate: festivalRow.start_date,
      endDate: festivalRow.end_date,
      place: festivalRow.place,
      stages: [{ name: 'Main' }, { name: 'Valley' }]
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(festivalRow.id);
    expect(concerts.map(concert => concert.stage_id)).toEqual([null, null]);
    expect(rpcCalls).toHaveLength(1);
  });

  it('saves new Stages with explicit per-Concert Stage choices in one domain operation', async () => {
    const mainId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const valleyId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const { client, rpcCalls, concerts, stages } = createMockEventsClient({
      rows: [festivalRow],
      concerts: [justice, phoenix]
    });

    const result = await updateEvent(client, {
      eventId: festivalRow.id,
      name: festivalRow.name,
      startDate: festivalRow.start_date,
      endDate: festivalRow.end_date,
      place: festivalRow.place,
      stages: [
        { id: mainId, name: 'Main' },
        { id: valleyId, name: 'Valley' }
      ],
      concertDates: [
        { concertId: justice.id, date: justice.date, stageId: mainId },
        { concertId: phoenix.id, date: phoenix.date, stageId: valleyId }
      ]
    });

    expect(result.error).toBeNull();
    expect(stages.map(stage => stage.name)).toEqual(['Main', 'Valley']);
    expect(concerts.map(concert => concert.stage_id)).toEqual([mainId, valleyId]);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]).toMatchObject({
      fn: 'save_event_and_concert_dates',
      p_event_id: festivalRow.id,
      p_stages: [
        { id: mainId, name: 'Main' },
        { id: valleyId, name: 'Valley' }
      ]
    });
  });

  it('renames a Stage without detaching Concerts', async () => {
    const stage: EventStageRecord = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      event_id: festivalRow.id,
      name: 'Main'
    };
    const stagedJustice: EventBillConcert = { ...justice, stage_id: stage.id };
    const { client, stages, concerts } = createMockEventsClient({
      rows: [festivalRow],
      concerts: [stagedJustice],
      stages: [stage]
    });

    const result = await updateEvent(client, {
      eventId: festivalRow.id,
      name: festivalRow.name,
      startDate: festivalRow.start_date,
      endDate: festivalRow.end_date,
      place: festivalRow.place,
      stages: [{ id: stage.id, name: 'Valley' }]
    });

    expect(result.error).toBeNull();
    expect(stages[0]?.name).toBe('Valley');
    expect(stages[0]?.id).toBe(stage.id);
    expect(concerts[0]?.stage_id).toBe(stage.id);
  });

  it('blocks turning Place-override off when Concert Places differ', async () => {
    const { client, updateCalls, rpcCalls } = createMockEventsClient({
      rows: [{ ...festivalRow, allow_place_override: true }],
      concerts: [{ ...justice, place: 'Lyon' }]
    });

    const result = await updateEvent(client, {
      eventId: festivalRow.id,
      name: festivalRow.name,
      startDate: festivalRow.start_date,
      endDate: festivalRow.end_date,
      place: festivalRow.place,
      allowPlaceOverride: false
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(EVENT_RULE.concertConflict);
    expect(result.error?.message).toContain(EVENT_RULE_MESSAGE.placeConflict);
    expect(result.error?.message).toContain('Justice');
    expect(updateCalls).toHaveLength(0);
    expect(rpcCalls).toHaveLength(0);
  });
});
