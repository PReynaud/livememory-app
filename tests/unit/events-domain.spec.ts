import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createEvent,
  getOwnedEvent,
  listOwnedEvents,
  EVENT_RULE,
  EVENT_RULE_MESSAGE,
  type EventRecord,
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
  insertCalls?: Record<string, unknown>[];
  getError?: { message: string; code?: string };
}) => {
  const rows = [...(options?.rows ?? [])];
  const insertCalls = options?.insertCalls ?? [];

  const client = {
    from: (table: 'events') => {
      expect(table).toBe('events');

      return {
        insert: (row: Record<string, unknown>) => {
          insertCalls.push(row);
          return {
            select: () => ({
              single: async () => {
                const created: EventRecord = {
                  id: '22222222-2222-4222-8222-222222222222',
                  owner_id: 'owner-1',
                  kind: row.kind as EventRecord['kind'],
                  name: String(row.name),
                  start_date: String(row.start_date),
                  end_date: String(row.end_date),
                  place: String(row.place)
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
            }
          })
        })
      };
    }
  };

  return { client: client as EventsClient, rows, insertCalls };
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

describe('events store and pages use domain helpers only', () => {
  it('keeps Event queries in shared/domain and out of pages and the store', () => {
    const store = readFileSync(resolve(process.cwd(), 'app/stores/events.ts'), 'utf8');
    expect(store).toMatch(/from '#shared\/domain\/events'/);
    expect(store).toMatch(/createEvent|listOwnedEvents|getOwnedEvent/);
    expect(store).not.toMatch(/from\('events'\)/);
    expect(store).toMatch(/\{ data, error \}|return \{[\s\S]*data:[\s\S]*error:/);
    expect(store).toMatch(/finally/);

    const pageFiles = [
      'app/pages/concerts.vue',
      'app/pages/e/[id].vue',
      'app/pages/home.vue'
    ];

    for (const file of pageFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/from\('events'\)/);
      expect(source).not.toMatch(/shared\/domain/);
    }

    expect(readFileSync(resolve(process.cwd(), 'app/pages/concerts.vue'), 'utf8')).toMatch(/useEventsStore/);
    expect(readFileSync(resolve(process.cwd(), 'app/pages/concerts.vue'), 'utf8')).toMatch(/New night/);
    expect(readFileSync(resolve(process.cwd(), 'app/pages/concerts.vue'), 'utf8')).toMatch(/New festival/);
    expect(readFileSync(resolve(process.cwd(), 'app/pages/e/[id].vue'), 'utf8')).toMatch(/useEventsStore/);
    expect(readFileSync(resolve(process.cwd(), 'app/pages/e/[id].vue'), 'utf8')).toMatch(/middleware:\s*'auth'/);
    expect(readFileSync(resolve(process.cwd(), 'app/app.vue'), 'utf8')).toMatch(/home\|concerts\|profile\|e/);
  });
});
