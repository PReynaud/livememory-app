import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createEvent,
  type EventRecord,
  type EventsClient
} from '../../shared/domain/events';
import {
  CONCERT_IDENTITY,
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

const otherNightRow: EventRecord = {
  id: '55555555-5555-4555-8555-555555555555',
  owner_id: 'owner-1',
  kind: 'single_night',
  name: 'Other Night',
  start_date: '2026-08-18',
  end_date: '2026-08-18',
  place: 'Berlin'
};

const parisNightRow: EventRecord = {
  id: '66666666-6666-4666-8666-666666666666',
  owner_id: 'owner-1',
  kind: 'single_night',
  name: 'Paris Night',
  start_date: '2026-08-18',
  end_date: '2026-08-18',
  place: 'Paris'
};

const timedJustice: ConcertRecord = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  event_id: nightRow.id,
  owner_id: nightRow.owner_id,
  artist: 'Justice',
  date: '2026-08-18',
  time: '20:15',
  place: 'Berlin'
};

const createMockConcertsClient = (options?: {
  events?: EventRecord[];
  concerts?: ConcertRecord[];
  concertInsertError?: QueryError;
  concertUpdateError?: QueryError;
  missFirstIdentityLookup?: boolean;
}) => {
  const events = [...(options?.events ?? [])];
  const concerts = [...(options?.concerts ?? [])];
  const concertInserts: Record<string, unknown>[] = [];
  const concertUpdates: Record<string, unknown>[] = [];
  const eventInserts: Record<string, unknown>[] = [];
  const eventDeletes: { column: string; value: string }[] = [];
  let identityLookups = 0;

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
                  owner_id: String(
                    row.owner_id
                    ?? events.find(event => event.id === row.event_id)?.owner_id
                    ?? 'owner-1'
                  ),
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
        select: () => {
          const concertEq = (filters: { column: string; value: string }[]) => {
            const matches = (concert: ConcertRecord) => {
              return filters.every(
                filter => concert[filter.column as keyof ConcertRecord] === filter.value
              );
            };

            return {
              eq: (column: string, value: string) => concertEq([...filters, { column, value }]),
              maybeSingle: async () => ({
                data: concerts.find(matches) ?? null,
                error: null
              }),
              order: async () => {
                if (filters.some(filter => filter.column === 'date')) {
                  identityLookups += 1;
                  if (options?.missFirstIdentityLookup && identityLookups === 1) {
                    return { data: [], error: null };
                  }
                }

                return {
                  data: concerts.filter(matches),
                  error: null
                };
              }
            };
          };

          return {
            order: async () => ({ data: concerts, error: null }),
            eq: (column: string, value: string) => concertEq([{ column, value }])
          };
        },
        update: (row: Record<string, unknown>) => {
          concertUpdates.push(row);
          return {
            eq: (column: string, value: string) => ({
              select: () => ({
                single: async () => {
                  if (options?.concertUpdateError) {
                    return { data: null, error: options.concertUpdateError };
                  }

                  const index = concerts.findIndex(
                    concert => concert[column as keyof ConcertRecord] === value
                  );
                  if (index < 0) {
                    return { data: null, error: { message: 'concert not found' } };
                  }

                  const updated: ConcertRecord = {
                    ...concerts[index]!,
                    time: row.time == null || row.time === '' ? null : String(row.time)
                  };
                  concerts[index] = updated;
                  return { data: updated, error: null };
                }
              })
            })
          };
        }
      };
    }
  };

  return {
    client: client as unknown as ConcertsClient & EventsClient,
    events,
    concerts,
    concertInserts,
    concertUpdates,
    eventInserts,
    eventDeletes
  };
};

describe('concerts migration kernel', () => {
  it('adds concerts with event FK, owner RLS, and insert date/place checks', () => {
    const concertsMigration = readMigrations().find(file =>
      file.name.includes('concerts') && !file.name.includes('identity')
    );

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

  it('copies owner_id, unique-guards timed identity, and allows owner time UPDATE', () => {
    const identityMigration = readMigrations().find(file => file.name.includes('concert_identity'));

    expect(identityMigration).toBeTruthy();
    const sql = identityMigration?.sql ?? '';

    expect(sql).toMatch(/owner_id/);
    expect(sql).toMatch(/row_number\(\) over/i);
    expect(sql).toMatch(/create unique index/i);
    expect(sql).toMatch(/lower\(\s*artist\s*\)/i);
    expect(sql).toMatch(/where[\s\S]*time[\s\S]*is not null/i);
    expect(sql).toMatch(/grant update/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/concerts\.date\s*>=\s*events\.start_date/);
    expect(sql).toMatch(/concerts\.place\s*=\s*events\.place/);
    expect(sql).toMatch(/\(select auth\.uid\(\)\)/);
    expect(sql).not.toMatch(/for delete/i);
    expect(sql).not.toMatch(/service_role/);
    expect(sql).not.toMatch(/where time is null/i);
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
    expect(start.outcome).toBe(CONCERT_IDENTITY.created);
  });

  it('attaches a timed same-Event match without inserting', async () => {
    const { client, concertInserts, concerts } = createMockConcertsClient({
      events: [nightRow],
      concerts: [timedJustice]
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'JUSTICE',
      date: '2026-08-18',
      time: '20:15'
    });

    expect(result.error).toBeNull();
    expect(result.outcome).toBe(CONCERT_IDENTITY.attached);
    expect(result.data?.id).toBe(timedJustice.id);
    expect(result.data?.event_id).toBe(nightRow.id);
    expect(concertInserts).toHaveLength(0);
    expect(concerts).toHaveLength(1);
  });

  it('attaches a timed match on another Event without reparenting', async () => {
    const { client, concertInserts } = createMockConcertsClient({
      events: [nightRow, otherNightRow],
      concerts: [timedJustice]
    });

    const result = await createConcert(client, {
      eventId: otherNightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: '20:15'
    });

    expect(result.error).toBeNull();
    expect(result.outcome).toBe(CONCERT_IDENTITY.attached);
    expect(result.data?.id).toBe(timedJustice.id);
    expect(result.data?.event_id).toBe(nightRow.id);
    expect(concertInserts).toHaveLength(0);
  });

  it('refuses a timed match at a different Place', async () => {
    const { client, concertInserts } = createMockConcertsClient({
      events: [nightRow, parisNightRow],
      concerts: [timedJustice]
    });

    const result = await createConcert(client, {
      eventId: parisNightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: '20:15'
    });

    expect(result.data).toBeNull();
    expect(result.outcome).toBe(CONCERT_IDENTITY.impossiblePlace);
    expect(result.error?.ruleId).toBe(CONCERT_RULE.impossiblePlace);
    expect(result.error?.message).toBe(CONCERT_RULE_MESSAGE.impossiblePlace);
    expect(concertInserts).toHaveLength(0);
  });

  it('asks for a choice when time is missing on one or both sides', async () => {
    const untimed: ConcertRecord = { ...timedJustice, time: null };
    const { client, concertInserts } = createMockConcertsClient({
      events: [nightRow],
      concerts: [untimed]
    });

    const bothNull = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18'
    });
    const draftTimed = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: '21:00'
    });

    const timedExisting = await createConcert(
      createMockConcertsClient({
        events: [nightRow],
        concerts: [timedJustice]
      }).client,
      {
        eventId: nightRow.id,
        artist: 'Justice',
        date: '2026-08-18'
      }
    );

    expect(bothNull.outcome).toBe(CONCERT_IDENTITY.needsChoice);
    expect(draftTimed.outcome).toBe(CONCERT_IDENTITY.needsChoice);
    expect(timedExisting.outcome).toBe(CONCERT_IDENTITY.needsChoice);
    expect(bothNull.data?.id).toBe(untimed.id);
    expect(concertInserts).toHaveLength(0);
  });

  it('writes draft time on confirmed attach when existing time is null', async () => {
    const untimed: ConcertRecord = { ...timedJustice, time: null };
    const { client, concertInserts, concertUpdates } = createMockConcertsClient({
      events: [nightRow],
      concerts: [untimed]
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: '21:00',
      confirm: 'attach'
    });

    expect(result.error).toBeNull();
    expect(result.outcome).toBe(CONCERT_IDENTITY.attached);
    expect(result.data?.id).toBe(untimed.id);
    expect(result.data?.time).toBe('21:00');
    expect(concertInserts).toHaveLength(0);
    expect(concertUpdates).toEqual([{ time: '21:00' }]);
  });

  it('attaches a timed match when the stored artist has surrounding whitespace', async () => {
    const padded: ConcertRecord = { ...timedJustice, artist: '  Justice  ' };
    const { client, concertInserts } = createMockConcertsClient({
      events: [nightRow],
      concerts: [padded]
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: '20:15'
    });

    expect(result.error).toBeNull();
    expect(result.outcome).toBe(CONCERT_IDENTITY.attached);
    expect(result.data?.id).toBe(padded.id);
    expect(concertInserts).toHaveLength(0);
  });

  it('maps a unique-guard violation on attach time write to attached, not persist_failed', async () => {
    const untimed: ConcertRecord = {
      ...timedJustice,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      time: null
    };
    const timed = { ...timedJustice, time: '21:00' };
    const { client, concertInserts } = createMockConcertsClient({
      events: [nightRow],
      concerts: [untimed, timed],
      concertUpdateError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "concerts_owner_artist_date_time_idx"'
      }
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: '21:00',
      confirm: 'attach'
    });

    expect(result.outcome).toBe(CONCERT_IDENTITY.attached);
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(timed.id);
    expect(result.error?.ruleId).not.toBe('persist_failed');
    expect(concertInserts).toHaveLength(0);
  });

  it('inserts a second row when the user confirms create after needs_choice', async () => {
    const untimed: ConcertRecord = { ...timedJustice, time: null };
    const { client, concertInserts, concerts } = createMockConcertsClient({
      events: [nightRow],
      concerts: [untimed]
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      confirm: 'create'
    });

    expect(result.error).toBeNull();
    expect(result.outcome).toBe(CONCERT_IDENTITY.created);
    expect(result.data?.id).not.toBe(untimed.id);
    expect(concertInserts).toHaveLength(1);
    expect(concerts).toHaveLength(2);
  });

  it('creates when the same artist and date have different clock times', async () => {
    const { client, concertInserts, concerts } = createMockConcertsClient({
      events: [nightRow],
      concerts: [timedJustice]
    });

    const result = await createConcert(client, {
      eventId: nightRow.id,
      artist: 'Justice',
      date: '2026-08-18',
      time: '21:00'
    });

    expect(result.error).toBeNull();
    expect(result.outcome).toBe(CONCERT_IDENTITY.created);
    expect(result.data?.id).not.toBe(timedJustice.id);
    expect(concertInserts).toHaveLength(1);
    expect(concerts).toHaveLength(2);
  });

  it('maps a unique-guard violation to attached or impossible_place, not persist_failed', async () => {
    const attached = await createConcert(
      createMockConcertsClient({
        events: [nightRow],
        concerts: [timedJustice],
        concertInsertError: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "concerts_owner_artist_date_time_idx"'
        },
        missFirstIdentityLookup: true
      }).client,
      {
        eventId: nightRow.id,
        artist: 'Justice',
        date: '2026-08-18',
        time: '20:15'
      }
    );

    expect(attached.outcome).toBe(CONCERT_IDENTITY.attached);
    expect(attached.error).toBeNull();
    expect(attached.data?.id).toBe(timedJustice.id);
    expect(attached.error?.ruleId).not.toBe('persist_failed');

    const refused = await createConcert(
      createMockConcertsClient({
        events: [nightRow, parisNightRow],
        concerts: [timedJustice],
        concertInsertError: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "concerts_owner_artist_date_time_idx"'
        },
        missFirstIdentityLookup: true
      }).client,
      {
        eventId: parisNightRow.id,
        artist: 'Justice',
        date: '2026-08-18',
        time: '20:15'
      }
    );

    expect(refused.outcome).toBe(CONCERT_IDENTITY.impossiblePlace);
    expect(refused.error?.ruleId).toBe(CONCERT_RULE.impossiblePlace);
    expect(refused.error?.ruleId).not.toBe('persist_failed');
  });

  it('does not leave a new Event when identity attaches or is refused', async () => {
    const { client, eventInserts, eventDeletes, concertInserts } = createMockConcertsClient({
      events: [nightRow],
      concerts: [timedJustice]
    });

    const attached = await createConcert(client, {
      artist: 'Justice',
      date: '2026-08-18',
      time: '20:15',
      newEvent: {
        kind: 'single_night',
        name: 'Leftover Night',
        startDate: '2026-08-18',
        place: 'Berlin'
      }
    });

    expect(attached.outcome).toBe(CONCERT_IDENTITY.attached);
    expect(eventInserts).toHaveLength(0);
    expect(eventDeletes).toHaveLength(0);
    expect(concertInserts).toHaveLength(0);

    const racedMock = createMockConcertsClient({
      events: [nightRow],
      concerts: [timedJustice],
      concertInsertError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "concerts_owner_artist_date_time_idx"'
      },
      missFirstIdentityLookup: true
    });
    const raced = await createConcert(racedMock.client, {
      artist: 'Justice',
      date: '2026-08-18',
      time: '20:15',
      newEvent: {
        kind: 'single_night',
        name: 'Race Night',
        startDate: '2026-08-18',
        place: 'Berlin'
      }
    });

    expect(raced.outcome).toBe(CONCERT_IDENTITY.attached);
    expect(raced.data?.event_id).toBe(nightRow.id);
    expect(racedMock.eventInserts).toHaveLength(1);
    expect(racedMock.eventDeletes).toEqual([
      { column: 'id', value: '33333333-3333-4333-8333-333333333333' }
    ]);
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
      owner_id: festivalRow.owner_id,
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
      owner_id: festivalRow.owner_id,
      artist: 'The Last Dinner Party',
      date: '2026-08-20',
      time: '20:15',
      place: 'Paris'
    };
    const second: ConcertRecord = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      event_id: festivalRow.id,
      owner_id: festivalRow.owner_id,
      artist: 'Justice',
      date: '2026-08-22',
      time: null,
      place: 'Paris'
    };
    const other: ConcertRecord = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      event_id: nightRow.id,
      owner_id: nightRow.owner_id,
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
    expect(store).toMatch(/outcome/);
    expect(store).toMatch(/ruleId/);

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
      if (!file.includes('AppAddConcertSheet')) {
        expect(source).not.toMatch(/shared\/domain/);
      }
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
    expect(sheet).toMatch(/navigateTo\('\/e\/' \+/);
    expect(sheet).toMatch(/CONCERT_RULE_MESSAGE/);
    expect(sheet).toMatch(/needs_choice|pendingChoice/);
    expect(sheet).toMatch(/:disabled="pendingChoice"/);
    expect(sheet).toMatch(/label="Cancel"|label='Cancel'/);

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
