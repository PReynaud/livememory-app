import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createEvent,
  type EventRecord,
  type EventsClient
} from '../../shared/domain/events';
import {
  CONCERT_RULE,
  CONCERT_RULE_MESSAGE,
  createConcert,
  dateOutsideEventMessage,
  listConcertsForEvent,
  listOwnedConcerts,
  type ConcertRecord,
  type ConcertsClient
} from '../../shared/domain/concerts';
import { groupConcertsByDate, shouldShowDayHeaders } from '../../app/utils/concert-groups';

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

const nightRow: EventRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  owner_id: 'owner-1',
  kind: 'single_night',
  name: 'Club Night',
  start_date: '2026-08-18',
  end_date: '2026-08-18',
  place: 'Berlin'
};

const festivalRow: EventRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  owner_id: 'owner-1',
  kind: 'festival',
  name: 'Rock Week',
  start_date: '2026-08-20',
  end_date: '2026-08-22',
  place: 'Paris'
};

type QueryError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

const createMockConcertsClient = (options?: {
  events?: EventRecord[];
  concerts?: ConcertRecord[];
  concertInsertError?: QueryError;
}) => {
  const events = [...(options?.events ?? [])];
  const concerts = [...(options?.concerts ?? [])];
  const concertInserts: Record<string, unknown>[] = [];
  const eventInserts: Record<string, unknown>[] = [];
  const eventDeletes: { column: string; value: string }[] = [];

  const client = {
    from: (table: 'events' | 'concerts') => {
      if (table === 'events') {
        return {
          insert: (row: Record<string, unknown>) => {
            eventInserts.push(row);
            return {
              select: () => ({
                single: async () => {
                  const created: EventRecord = {
                    id: '33333333-3333-4333-8333-333333333333',
                    owner_id: 'owner-1',
                    kind: row.kind as EventRecord['kind'],
                    name: String(row.name),
                    start_date: String(row.start_date),
                    end_date: String(row.end_date),
                    place: String(row.place)
                  };
                  events.push(created);
                  return { data: created, error: null };
                }
              })
            };
          },
          select: () => ({
            order: async () => ({ data: events, error: null }),
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: events.find(event => event.id === value) ?? null,
                error: null
              }),
              order: async () => ({
                data: events.filter(event => event.id === value),
                error: null
              })
            })
          }),
          delete: () => ({
            eq: async (column: string, value: string) => {
              eventDeletes.push({ column, value });
              const index = events.findIndex(event => event[column as keyof EventRecord] === value);
              if (index >= 0) {
                events.splice(index, 1);
              }

              return { data: null, error: null };
            }
          })
        };
      }

      return {
        insert: (row: Record<string, unknown>) => {
          concertInserts.push(row);
          return {
            select: () => ({
              single: async () => {
                if (options?.concertInsertError) {
                  return { data: null, error: options.concertInsertError };
                }

                const created: ConcertRecord = {
                  id: `44444444-4444-4444-8444-${String(concerts.length).padStart(12, '0')}`,
                  event_id: String(row.event_id),
                  artist: String(row.artist),
                  date: String(row.date),
                  time: row.time == null || row.time === '' ? null : String(row.time),
                  place: String(row.place)
                };
                concerts.push(created);
                return { data: created, error: null };
              }
            })
          };
        },
        select: () => ({
          order: async () => ({ data: concerts, error: null }),
          eq: (column: string, value: string) => ({
            maybeSingle: async () => ({
              data: concerts.find(concert => concert[column as keyof ConcertRecord] === value) ?? null,
              error: null
            }),
            order: async () => ({
              data: concerts.filter(concert => concert[column as keyof ConcertRecord] === value),
              error: null
            })
          })
        })
      };
    }
  };

  return {
    client: client as unknown as ConcertsClient & EventsClient,
    events,
    concerts,
    concertInserts,
    eventInserts,
    eventDeletes
  };
};

describe('concerts migration kernel', () => {
  it('adds concerts with event FK, owner RLS, and insert date/place checks', () => {
    const concertsMigration = readMigrations().find(file => file.name.includes('concerts'));

    expect(concertsMigration).toBeTruthy();
    const sql = concertsMigration?.sql ?? '';

    expect(sql).toMatch(/create table public\.concerts/);
    expect(sql).toMatch(/event_id\s+uuid\s+not null/i);
    expect(sql).toMatch(/references public\.events/);
    expect(sql).toMatch(/artist/);
    expect(sql).toMatch(/\bdate\b/);
    expect(sql).toMatch(/"time"|time\s+time/i);
    expect(sql).toMatch(/place/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/\(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/grant select,\s*insert/i);
    expect(sql).toMatch(/concerts\.date\s*>=\s*events\.start_date/);
    expect(sql).toMatch(/concerts\.date\s*<=\s*events\.end_date/);
    expect(sql).toMatch(/concerts\.place\s*=\s*events\.place/);
    expect(sql).not.toMatch(/for delete/i);
    expect(sql).not.toMatch(/service_role/);
  });
});

describe('createConcert', () => {
  it('creates an owned concert and copies Place from the Event', async () => {
    const { client, concertInserts } = createMockConcertsClient({
      events: [nightRow]
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: '  Justice  ',
      date: '2026-08-18',
      time: ''
    });

    expect(result.error).toBeNull();
    expect(result.data?.artist).toBe('Justice');
    expect(result.data?.event_id).toBe(nightRow.id);
    expect(result.data?.date).toBe('2026-08-18');
    expect(result.data?.time).toBeNull();
    expect(result.data?.place).toBe('Berlin');
    expect(result.data?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(concertInserts[0]).toMatchObject({
      event_id: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: null,
      place: 'Berlin'
    });
  });

  it('allows a future date and a blank time', async () => {
    const { client, concertInserts } = createMockConcertsClient({
      events: [{
        ...nightRow,
        start_date: '2026-12-01',
        end_date: '2026-12-01'
      }]
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Fontaines D.C.',
      date: '2026-12-01'
    });

    expect(result.error).toBeNull();
    expect(result.data?.date).toBe('2026-12-01');
    expect(result.data?.time).toBeNull();
    expect(concertInserts[0]).toMatchObject({
      date: '2026-12-01',
      time: null
    });
  });

  it('rejects a missing artist with a named required-field error and does not insert', async () => {
    const { client, concertInserts } = createMockConcertsClient({
      events: [nightRow]
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: '  ',
      date: '2026-08-18'
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(CONCERT_RULE.requiredArtist);
    expect(result.error?.message).toBe(CONCERT_RULE_MESSAGE.requiredArtist);
    expect(concertInserts).toHaveLength(0);
  });

  it('rejects a missing date or Event with a named required-field error and does not insert', async () => {
    const { client, concertInserts } = createMockConcertsClient({
      events: [nightRow]
    });

    const missingDate = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: ''
    });

    expect(missingDate.data).toBeNull();
    expect(missingDate.error?.ruleId).toBe(CONCERT_RULE.requiredDate);
    expect(missingDate.error?.message).toBe(CONCERT_RULE_MESSAGE.requiredDate);

    const missingEvent = await createConcert(client, {
      artist: 'Justice',
      date: '2026-08-18'
    });

    expect(missingEvent.data).toBeNull();
    expect(missingEvent.error?.ruleId).toBe(CONCERT_RULE.requiredEvent);
    expect(missingEvent.error?.message).toBe(CONCERT_RULE_MESSAGE.requiredEvent);
    expect(concertInserts).toHaveLength(0);
  });

  it('rejects a festival day outside the Event range and names the range', async () => {
    const { client, concertInserts } = createMockConcertsClient({
      events: [festivalRow]
    });

    const before = await createConcert(client, {
      eventId: festivalRow.id,
      artist: 'Justice',
      date: '2026-08-19'
    });

    expect(before.data).toBeNull();
    expect(before.error?.ruleId).toBe(CONCERT_RULE.dateOutsideEvent);
    expect(before.error?.message).toBe(dateOutsideEventMessage(festivalRow));
    expect(before.error?.message).toContain(CONCERT_RULE_MESSAGE.dateOutsideEvent);
    expect(before.error?.message).toContain('20/08/2026');
    expect(before.error?.message).toContain('22/08/2026');

    const after = await createConcert(client, {
      eventId: festivalRow.id,
      artist: 'Justice',
      date: '2026-08-23'
    });

    expect(after.data).toBeNull();
    expect(after.error?.ruleId).toBe(CONCERT_RULE.dateOutsideEvent);
    expect(concertInserts).toHaveLength(0);
  });

  it('allows a festival day on the inclusive start and end', async () => {
    const { client } = createMockConcertsClient({
      events: [festivalRow]
    });

    const start = await createConcert(client, {
      eventId: festivalRow.id,
      artist: 'The Last Dinner Party',
      date: '2026-08-20'
    });
    const end = await createConcert(client, {
      eventId: festivalRow.id,
      artist: 'Justice',
      date: '2026-08-22',
      time: '23:45'
    });

    expect(start.error).toBeNull();
    expect(end.error).toBeNull();
    expect(end.data?.time).toBe('23:45');
    expect(end.data?.place).toBe('Paris');
  });

  // Story 1.4 (AD-10) attaches timed owner identity instead of inserting a second row.
  it('allows duplicate artist, date, and time rows', async () => {
    const { client, concertInserts } = createMockConcertsClient({
      events: [nightRow]
    });

    const first = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: '20:15'
    });
    const second = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: '20:15'
    });

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data?.id).not.toBe(second.data?.id);
    expect(concertInserts).toHaveLength(2);
  });

  it('creates a named night Event and Concert in one save', async () => {
    const { client, eventInserts, concertInserts } = createMockConcertsClient();

    const result = await createConcert(client, {
      artist: 'Justice',
      date: '2026-08-10',
      newEvent: {
        kind: 'single_night',
        name: 'Club Night',
        startDate: '2026-08-10',
        place: 'Berlin'
      }
    });

    expect(result.error).toBeNull();
    expect(result.data?.event_id).toBe('33333333-3333-4333-8333-333333333333');
    expect(result.data?.place).toBe('Berlin');
    expect(eventInserts[0]).toMatchObject({
      kind: 'single_night',
      name: 'Club Night',
      start_date: '2026-08-10',
      end_date: '2026-08-10',
      place: 'Berlin'
    });
    expect(concertInserts[0]).toMatchObject({
      artist: 'Justice',
      date: '2026-08-10',
      place: 'Berlin'
    });
  });

  it('rejects a newEvent Concert date outside the Event range without persisting the Event', async () => {
    const { client, events, eventInserts, concertInserts, eventDeletes } = createMockConcertsClient();

    const result = await createConcert(client, {
      artist: 'Justice',
      date: '2026-08-19',
      newEvent: {
        kind: 'festival',
        name: 'Rock Week',
        startDate: '2026-08-20',
        endDate: '2026-08-22',
        place: 'Paris'
      }
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(CONCERT_RULE.dateOutsideEvent);
    expect(result.error?.message).toContain(CONCERT_RULE_MESSAGE.dateOutsideEvent);
    expect(result.error?.message).toContain('20/08/2026');
    expect(result.error?.message).toContain('22/08/2026');
    expect(eventInserts).toHaveLength(0);
    expect(concertInserts).toHaveLength(0);
    expect(eventDeletes).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('rejects a newEvent single_night Concert date that does not match the Event date without persisting', async () => {
    const { client, events, eventInserts, concertInserts, eventDeletes } = createMockConcertsClient();

    const result = await createConcert(client, {
      artist: 'Justice',
      date: '2026-08-23',
      newEvent: {
        kind: 'single_night',
        name: 'Club Night',
        startDate: '2026-08-10',
        place: 'Berlin'
      }
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(CONCERT_RULE.dateOutsideEvent);
    expect(concertInserts).toHaveLength(0);
    expect(eventInserts).toHaveLength(0);
    expect(eventDeletes).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('still applies Event rules when creating a night from the sheet', async () => {
    const { client, concertInserts } = createMockConcertsClient();

    const result = await createConcert(client, {
      artist: 'Justice',
      date: '2026-08-10',
      newEvent: {
        kind: 'single_night',
        name: '  ',
        startDate: '2026-08-10',
        place: 'Berlin'
      }
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Name is required.');
    expect(concertInserts).toHaveLength(0);
  });

  it('returns persist_failed when concert insert fails and keeps an existing Event', async () => {
    const { client, events, eventDeletes } = createMockConcertsClient({
      events: [nightRow],
      concertInsertError: { message: 'insert denied' }
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18'
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe('persist_failed');
    expect(result.error?.message).toBe('insert denied');
    expect(eventDeletes).toHaveLength(0);
    expect(events.map(event => event.id)).toEqual([nightRow.id]);
  });

  it('rolls back a newly created Event when concert insert fails', async () => {
    const { client, events, eventInserts, eventDeletes } = createMockConcertsClient({
      concertInsertError: { message: 'insert denied' }
    });

    const result = await createConcert(client, {
      artist: 'Justice',
      date: '2026-08-10',
      newEvent: {
        kind: 'single_night',
        name: 'Club Night',
        startDate: '2026-08-10',
        place: 'Berlin'
      }
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe('persist_failed');
    expect(result.error?.message).toBe('insert denied');
    expect(eventInserts).toHaveLength(1);
    expect(eventDeletes).toEqual([
      { column: 'id', value: '33333333-3333-4333-8333-333333333333' }
    ]);
    expect(events).toHaveLength(0);
  });
});

describe('concert date grouping', () => {
  it('groups consecutive same-day rows and shows day headers for festivals or 2+ concerts', () => {
    const friday: ConcertRecord = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      event_id: festivalRow.id,
      artist: 'The Last Dinner Party',
      date: '2026-08-20',
      time: '20:15',
      place: 'Paris'
    };
    const fridayTwo: ConcertRecord = {
      ...friday,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      artist: 'Fontaines D.C.',
      time: '22:00'
    };
    const saturday: ConcertRecord = {
      ...friday,
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      artist: 'Justice',
      date: '2026-08-22',
      time: null
    };

    const groups = groupConcertsByDate([friday, fridayTwo, saturday]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.date).toBe('2026-08-20');
    expect(groups[0]?.concerts).toHaveLength(2);
    expect(groups[1]?.date).toBe('2026-08-22');
    expect(shouldShowDayHeaders(festivalRow, [friday])).toBe(true);
    expect(shouldShowDayHeaders(nightRow, [friday])).toBe(false);
    expect(shouldShowDayHeaders(nightRow, [friday, fridayTwo])).toBe(true);
  });
});

describe('listConcertsForEvent and listOwnedConcerts', () => {
  it('lists concerts for an owned Event and the full owned log', async () => {
    const first: ConcertRecord = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      event_id: festivalRow.id,
      artist: 'The Last Dinner Party',
      date: '2026-08-20',
      time: '20:15',
      place: 'Paris'
    };
    const second: ConcertRecord = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      event_id: festivalRow.id,
      artist: 'Justice',
      date: '2026-08-22',
      time: null,
      place: 'Paris'
    };
    const other: ConcertRecord = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      event_id: nightRow.id,
      artist: 'Local Band',
      date: '2026-08-18',
      time: null,
      place: 'Berlin'
    };

    const { client } = createMockConcertsClient({
      events: [festivalRow, nightRow],
      concerts: [second, other, first]
    });

    const forEvent = await listConcertsForEvent(client, festivalRow.id);
    expect(forEvent.error).toBeNull();
    expect(forEvent.data?.map(concert => concert.artist)).toEqual([
      'The Last Dinner Party',
      'Justice'
    ]);

    const owned = await listOwnedConcerts(client);
    expect(owned.error).toBeNull();
    expect(owned.data).toHaveLength(3);
  });
});

describe('concerts store and pages use domain helpers only', () => {
  it('keeps Concert queries in shared/domain and out of pages and the store', () => {
    const store = readFileSync(resolve(process.cwd(), 'app/stores/events.ts'), 'utf8');
    expect(store).toMatch(/from '#shared\/domain\/concerts'/);
    expect(store).toMatch(/createConcert|listOwnedConcerts|listConcertsForEvent/);
    expect(store).not.toMatch(/from\('concerts'\)/);
    expect(store).toMatch(/\{ data, error \}|return \{[\s\S]*data:[\s\S]*error:/);
    expect(store).toMatch(/finally/);
    expect(store).toMatch(/listedConcerts\.error|listed\.error/);
    expect(store).toMatch(/silent/);

    const pageFiles = [
      'app/pages/concerts.vue',
      'app/pages/e/[id].vue',
      'app/pages/home.vue',
      'app/components/AppAddConcertSheet.vue',
      'app/components/AppGlassNav.vue'
    ];

    for (const file of pageFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/from\('concerts'\)/);
      expect(source).not.toMatch(/from\('events'\)/);
      expect(source).not.toMatch(/shared\/domain/);
    }

    const eventPage = readFileSync(resolve(process.cwd(), 'app/pages/e/[id].vue'), 'utf8');
    expect(eventPage).toMatch(/Add to this night/);
    expect(eventPage).toMatch(/Add to this festival/);
    expect(eventPage).toMatch(/billLoadFailed/);
    expect(eventPage).not.toMatch(/label="Add concert"|label='Add concert'/);

    const concertsPage = readFileSync(resolve(process.cwd(), 'app/pages/concerts.vue'), 'utf8');
    expect(concertsPage).toMatch(/New night/);
    expect(concertsPage).toMatch(/New festival/);
    expect(concertsPage).toMatch(/openSheet|openAddSheet/);

    const sheet = readFileSync(resolve(process.cwd(), 'app/components/AppAddConcertSheet.vue'), 'utf8');
    expect(sheet).toMatch(/USlideover/);
    expect(sheet).toMatch(/side="bottom"/);
    expect(sheet).toMatch(/Add concert/);
    expect(sheet).toMatch(/Add another/);

    const app = readFileSync(resolve(process.cwd(), 'app/app.vue'), 'utf8');
    expect(app).toMatch(/AppAddConcertSheet/);
    expect(app).toMatch(/shouldOpenAddSheetOnKeydown/);

    const home = readFileSync(resolve(process.cwd(), 'app/pages/home.vue'), 'utf8');
    expect(home).toMatch(/openSheet|openAddSheet/);

    const nav = readFileSync(resolve(process.cwd(), 'app/components/AppGlassNav.vue'), 'utf8');
    expect(nav).toMatch(/openSheet|openAddSheet/);
  });

  it('exports createEvent for New night/New festival Event rules', () => {
    expect(typeof createEvent).toBe('function');
  });
});
