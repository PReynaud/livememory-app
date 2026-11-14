import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE_RULE,
  ATTENDANCE_RULE_MESSAGE,
  attendThisNight,
  clearAttendance,
  isAttendanceStatus,
  isConcertPast,
  isConcertSeen,
  isNightGoingPressed,
  listMyAttendance,
  setAttendance,
  type AttendanceRecord,
  type AttendanceClient
} from '../../shared/domain/attendance';
import { selectLastNightEvent, souvenirStats } from '../../shared/domain/home';

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

const attendanceSql = () => {
  const migration = readMigrations().find(file => file.name.includes('attendance'));
  return migration?.sql ?? '';
};

type QueryError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

const goingRow: AttendanceRecord = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  user_id: 'user-1',
  concert_id: 'concert-future',
  status: 'going'
};

const attendedRow: AttendanceRecord = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  user_id: 'user-1',
  concert_id: 'concert-past',
  status: 'attended'
};

type EventKindRow = {
  id: string;
  kind: 'single_night' | 'festival';
};

type ConcertBillRow = {
  id: string;
  event_id: string;
  date: string;
  time: string | null;
};

const createMockAttendanceClient = (options?: {
  rows?: AttendanceRecord[];
  effectiveRows?: AttendanceRecord[];
  events?: EventKindRow[];
  concerts?: ConcertBillRow[];
  insertError?: QueryError;
  updateError?: QueryError;
  deleteError?: QueryError;
  listError?: QueryError;
  effectiveGetError?: QueryError;
  eventGetError?: QueryError;
  concertListError?: QueryError;
}) => {
  const rows = [...(options?.rows ?? [])];
  const events = [...(options?.events ?? [])];
  const concerts = [...(options?.concerts ?? [])];
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const deletes: { column: string; value: string }[] = [];
  const relations: string[] = [];

  const effectiveFor = (row: AttendanceRecord): AttendanceRecord => {
    const override = options?.effectiveRows?.find(entry => entry.concert_id === row.concert_id);
    return override ?? row;
  };

  const client = {
    from: (relation: 'attendance' | 'attendance_effective' | 'events' | 'concerts') => {
      relations.push(relation);

      if (relation === 'events') {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => {
                if (options?.eventGetError) {
                  return { data: null, error: options.eventGetError };
                }

                return {
                  data: events.find(entry => entry.id === value) ?? null,
                  error: null
                };
              }
            })
          })
        };
      }

      if (relation === 'concerts') {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              order: async () => {
                if (options?.concertListError) {
                  return { data: null, error: options.concertListError };
                }

                return {
                  data: concerts.filter(entry => entry.event_id === value),
                  error: null
                };
              }
            })
          })
        };
      }

      if (relation === 'attendance_effective') {
        return {
          select: () => ({
            order: async () => {
              if (options?.listError) {
                return { data: null, error: options.listError };
              }

              return { data: rows.map(effectiveFor), error: null };
            },
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => {
                if (options?.effectiveGetError) {
                  return { data: null, error: options.effectiveGetError };
                }

                const row = rows.find(entry => entry.concert_id === value);
                return { data: row ? effectiveFor(row) : null, error: null };
              }
            })
          })
        };
      }

      return {
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          return {
            select: () => ({
              single: async () => {
                if (options?.insertError) {
                  return { data: null, error: options.insertError };
                }

                const created: AttendanceRecord = {
                  id: `cccccccc-cccc-4ccc-8ccc-${String(rows.length).padStart(12, '0')}`,
                  user_id: String(row.user_id ?? 'user-1'),
                  concert_id: String(row.concert_id),
                  status: row.status === 'attended' || row.status === 'missed' ? row.status as AttendanceRecord['status'] : 'going'
                };
                rows.push(created);
                return { data: created, error: null };
              }
            })
          };
        },
        select: () => ({
          eq: (_column: string, value: string) => ({
            maybeSingle: async () => ({
              data: rows.find(entry => entry.concert_id === value) ?? null,
              error: null
            })
          })
        }),
        update: (row: Record<string, unknown>) => {
          updates.push(row);
          return {
            eq: (column: string, value: string) => ({
              select: () => ({
                single: async () => {
                  if (options?.updateError) {
                    return { data: null, error: options.updateError };
                  }

                  const index = rows.findIndex(
                    entry => entry[column as keyof AttendanceRecord] === value
                  );
                  if (index < 0) {
                    return { data: null, error: { message: 'attendance not found' } };
                  }

                  const updated: AttendanceRecord = {
                    ...rows[index]!,
                    status: row.status === 'attended' || row.status === 'missed' ? row.status as AttendanceRecord['status'] : 'going'
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
            deletes.push({ column, value });
            if (options?.deleteError) {
              return { data: null, error: options.deleteError };
            }

            const index = rows.findIndex(
              entry => entry[column as keyof AttendanceRecord] === value
            );
            if (index >= 0) {
              rows.splice(index, 1);
            }

            return { data: null, error: null };
          }
        })
      };
    }
  };

  return {
    client: client as unknown as AttendanceClient,
    rows,
    inserts,
    updates,
    deletes,
    relations
  };
};

describe('attendance migration kernel', () => {
  it('adds attendance with unique own-row RLS, effective view, and write triggers', () => {
    const sql = attendanceSql();
    expect(sql).toMatch(/create table public\.attendance/);
    expect(sql).toMatch(/user_id/);
    expect(sql).toMatch(/references auth\.users/);
    expect(sql).toMatch(/concert_id/);
    expect(sql).toMatch(/references public\.concerts/);
    expect(sql).toMatch(/on delete cascade/i);
    expect(sql).toMatch(/status/);
    expect(sql).toMatch(/unique\s*\(\s*user_id\s*,\s*concert_id\s*\)/i);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/grant select,\s*insert,\s*update,\s*delete/i);
    expect(sql).toMatch(/\(select auth\.uid\(\)\)\s*=\s*user_id/);
    expect(sql).toMatch(/exists\s*\([\s\S]*from public\.concerts/);
    expect(sql).toMatch(/concert_is_past/);
    expect(sql).toMatch(/security_invoker\s*=\s*true/);
    expect(sql).toMatch(/attendance_effective/);
    expect(sql).toMatch(/Europe\/Paris/);
    expect(sql).toMatch(/function public\.attendance_enforce_status\(\)[\s\S]*?set search_path = ''/);
    expect(sql).not.toMatch(/service_role/);
    expect(sql).not.toMatch(/pg_cron|cron\.schedule/i);

    const functionBodies = [...sql.matchAll(/create or replace function public\.concert_is_past[\s\S]*?\$\$;/gi)];
    expect(functionBodies.length).toBeGreaterThan(0);
    expect(functionBodies[0]?.[0]).not.toMatch(/update\s+public\.attendance/i);

    const viewBody = sql.match(/create(?:\s+or\s+replace)?\s+view public\.attendance_effective[\s\S]*/i)?.[0] ?? '';
    expect(viewBody).not.toMatch(/update\s+public\.attendance/i);
    expect(viewBody).not.toMatch(/insert\s+into\s+public\.attendance/i);
  });
});

describe('seen by default', () => {
  it('reads a past concert as seen unless it is marked missed, and never an upcoming one', () => {
    expect(isConcertSeen(true, null)).toBe(true);
    expect(isConcertSeen(true, 'attended')).toBe(true);
    expect(isConcertSeen(true, 'going')).toBe(true);
    expect(isConcertSeen(true, 'missed')).toBe(false);
    expect(isConcertSeen(false, null)).toBe(false);
    expect(isConcertSeen(false, 'going')).toBe(false);
  });

  it('accepts going, attended, and missed only', () => {
    expect(isAttendanceStatus('going')).toBe(true);
    expect(isAttendanceStatus('attended')).toBe(true);
    expect(isAttendanceStatus('missed')).toBe(true);
    expect(isAttendanceStatus('maybe')).toBe(false);
    expect(isAttendanceStatus(null)).toBe(false);
  });

  it('migrates missed (past only) and rebuilds the effective and shared list views from visible concerts', () => {
    const migration = readMigrations().find(file => file.name.includes('attendance_seen_by_default'));
    const sql = migration?.sql ?? '';
    expect(sql).toMatch(/check \(status in \('going', 'attended', 'missed'\)\)/);
    expect(sql).toMatch(/new\.status = 'missed' and not is_past[\s\S]*future_missed/);

    const effective = sql.slice(sql.indexOf('view public.attendance_effective'), sql.indexOf('view public.shared_list_concerts'));
    expect(effective).toMatch(/security_invoker = true/);
    expect(effective).toMatch(/from public\.concerts\s+left join public\.attendance/);
    expect(effective).toMatch(/attendance\.user_id = \(select auth\.uid\(\)\)/);
    expect(effective).toMatch(/when attendance\.status = 'missed' then 'missed'/);
    expect(effective).toMatch(/when public\.concert_is_past\(concerts\.date, concerts\."time"\) then 'attended'/);

    const shared = sql.slice(sql.indexOf('view public.shared_list_concerts'));
    expect(shared).toMatch(/events\.owner_id = profiles\.id/);
    expect(shared).toMatch(/event_members\.user_id = profiles\.id/);
    expect(shared).toMatch(/left join public\.attendance/);
    expect(shared).toMatch(/\) in \('going', 'attended'\)/);
    expect(shared).toMatch(/revoke all on table public\.shared_list_concerts from public, anon, authenticated/);
  });
});

describe('isNightGoingPressed', () => {
  it('is pressed only when every concert is going or attended', () => {
    expect(isNightGoingPressed([])).toBe(false);
    expect(isNightGoingPressed(['going', 'attended'])).toBe(true);
    expect(isNightGoingPressed(['going', null])).toBe(false);
    expect(isNightGoingPressed(['going'])).toBe(true);
  });
});

describe('isConcertPast', () => {
  it('treats untimed concerts as upcoming until the next Paris calendar day', () => {
    const concert = { date: '2026-08-18', time: null };
    const stillUpcoming = new Date('2026-08-18T21:59:00.000Z');
    const nowPast = new Date('2026-08-18T22:00:00.000Z');

    expect(isConcertPast(concert, stillUpcoming)).toBe(false);
    expect(isConcertPast(concert, nowPast)).toBe(true);
  });

  it('treats timed concerts as past after the Paris local clock', () => {
    const concert = { date: '2026-08-19', time: '10:00' };
    const before = new Date('2026-08-19T07:59:00.000Z');
    const after = new Date('2026-08-19T08:00:01.000Z');

    expect(isConcertPast(concert, before)).toBe(false);
    expect(isConcertPast(concert, after)).toBe(true);
  });
});

describe('setAttendance / clearAttendance / listMyAttendance', () => {
  it('stores going for a future unset concert', async () => {
    const { client, inserts, relations } = createMockAttendanceClient();

    const result = await setAttendance(client, {
      concertId: 'concert-future',
      status: 'going'
    });

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe('going');
    expect(result.data?.concert_id).toBe('concert-future');
    expect(inserts[0]).toMatchObject({
      concert_id: 'concert-future',
      status: 'going'
    });
    expect(relations).toContain('attendance');
    expect(relations).toContain('attendance_effective');
  });

  it('stores attended for a past unset concert', async () => {
    const { client, inserts } = createMockAttendanceClient();

    const result = await setAttendance(client, {
      concertId: 'concert-past',
      status: 'attended'
    });

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe('attended');
    expect(inserts[0]).toMatchObject({
      concert_id: 'concert-past',
      status: 'attended'
    });
  });

  it('lists effective status from SQL, including stored going that reads as attended', async () => {
    const { client, relations } = createMockAttendanceClient({
      rows: [goingRow],
      effectiveRows: [{ ...goingRow, status: 'attended' }]
    });

    const result = await listMyAttendance(client);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        ...goingRow,
        status: 'attended'
      }
    ]);
    expect(relations).toContain('attendance_effective');
    expect(relations.filter(relation => relation === 'attendance')).toHaveLength(0);
  });

  it('clears the row at the past boundary and stays unset', async () => {
    const { client, deletes, rows } = createMockAttendanceClient({
      rows: [attendedRow]
    });

    const result = await clearAttendance(client, 'concert-past');

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
    expect(deletes[0]).toEqual({ column: 'concert_id', value: 'concert-past' });
    expect(rows).toHaveLength(0);

    const listed = await listMyAttendance(client);
    expect(listed.data).toEqual([]);
  });

  it('rejects future attended with a named rule', async () => {
    const { client, inserts } = createMockAttendanceClient({
      insertError: {
        code: 'P0001',
        message: 'future_attended',
        details: 'Cannot mark a future concert as attended.'
      }
    });

    const result = await setAttendance(client, {
      concertId: 'concert-future',
      status: 'attended'
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(ATTENDANCE_RULE.futureAttended);
    expect(result.error?.message).toBe(ATTENDANCE_RULE_MESSAGE.futureAttended);
    expect(inserts[0]).toMatchObject({ status: 'attended' });
  });

  it('rejects attended to going with a named rule', async () => {
    const { client, updates } = createMockAttendanceClient({
      rows: [attendedRow],
      updateError: {
        code: 'P0001',
        message: 'attended_to_going',
        details: 'Cannot change attended to going.'
      }
    });

    const result = await setAttendance(client, {
      concertId: 'concert-past',
      status: 'going'
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(ATTENDANCE_RULE.attendedToGoing);
    expect(result.error?.message).toBe(ATTENDANCE_RULE_MESSAGE.attendedToGoing);
    expect(updates[0]).toMatchObject({ status: 'going' });
  });

  it('stores missed on a past concert so it reads as not seen', async () => {
    const { client, inserts } = createMockAttendanceClient();

    const result = await setAttendance(client, {
      concertId: 'concert-past',
      status: 'missed'
    });

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe('missed');
    expect(inserts[0]).toMatchObject({ concert_id: 'concert-past', status: 'missed' });
  });

  it('updates a stored attended row to missed', async () => {
    const { client, updates } = createMockAttendanceClient({ rows: [attendedRow] });

    const result = await setAttendance(client, {
      concertId: 'concert-past',
      status: 'missed'
    });

    expect(result.error).toBeNull();
    expect(updates[0]).toMatchObject({ status: 'missed' });
  });

  it('rejects future missed with a named rule', async () => {
    const { client } = createMockAttendanceClient({
      insertError: {
        code: 'P0001',
        message: 'future_missed',
        details: 'Cannot mark a future concert as not seen.'
      }
    });

    const result = await setAttendance(client, {
      concertId: 'concert-future',
      status: 'missed'
    });

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(ATTENDANCE_RULE.futureMissed);
    expect(result.error?.message).toBe(ATTENDANCE_RULE_MESSAGE.futureMissed);
  });

  it('rejects an unknown status before writing', async () => {
    const { client, inserts } = createMockAttendanceClient();

    const result = await setAttendance(client, {
      concertId: 'concert-past',
      status: 'maybe' as AttendanceRecord['status']
    });

    expect(result.error?.message).toBe('Attendance must be going, attended, or missed');
    expect(inserts).toHaveLength(0);
  });

  it('returns the written row when the effective read fails after a successful insert', async () => {
    const { client } = createMockAttendanceClient({
      effectiveGetError: { message: 'view unavailable' }
    });

    const result = await setAttendance(client, {
      concertId: 'concert-future',
      status: 'going'
    });

    expect(result.error).toBeNull();
    expect(result.data?.concert_id).toBe('concert-future');
    expect(result.data?.status).toBe('going');
  });
});

describe('attendThisNight', () => {
  const nightId = 'event-night';
  const festivalId = 'event-festival';
  const futureConcert: ConcertBillRow = {
    id: 'concert-future',
    event_id: nightId,
    date: '2026-12-01',
    time: null
  };
  const pastConcert: ConcertBillRow = {
    id: 'concert-past',
    event_id: nightId,
    date: '2026-08-18',
    time: null
  };
  const otherNightConcert: ConcertBillRow = {
    id: 'concert-other',
    event_id: 'event-other',
    date: '2026-12-01',
    time: null
  };

  it('marks current future Concerts going and past Concerts attended', async () => {
    const { client, inserts, relations } = createMockAttendanceClient({
      events: [{ id: nightId, kind: 'single_night' }],
      concerts: [futureConcert, pastConcert, otherNightConcert]
    });

    const result = await attendThisNight(client, nightId, new Date('2026-08-19T12:00:00.000Z'));

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      expect.objectContaining({ concert_id: 'concert-future', status: 'going' }),
      expect.objectContaining({ concert_id: 'concert-past', status: 'attended' })
    ]);
    expect(inserts).toEqual([
      { concert_id: 'concert-future', status: 'going' },
      { concert_id: 'concert-past', status: 'attended' }
    ]);
    expect(relations).toContain('events');
    expect(relations).toContain('concerts');
    expect(relations).toContain('attendance');
  });

  it('does not mark Concerts that are not currently on that Bill', async () => {
    const { client, inserts } = createMockAttendanceClient({
      events: [{ id: nightId, kind: 'single_night' }],
      concerts: [futureConcert]
    });

    const result = await attendThisNight(client, nightId, new Date('2026-08-19T12:00:00.000Z'));

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      expect.objectContaining({ concert_id: 'concert-future', status: 'going' })
    ]);
    expect(inserts).toEqual([{ concert_id: 'concert-future', status: 'going' }]);
    expect(inserts.some(row => row.concert_id === 'concert-later')).toBe(false);
  });

  it('keeps a cleared Concert unset after attend-all', async () => {
    const { client, rows } = createMockAttendanceClient({
      events: [{ id: nightId, kind: 'single_night' }],
      concerts: [futureConcert, pastConcert]
    });

    await attendThisNight(client, nightId, new Date('2026-08-19T12:00:00.000Z'));
    const cleared = await clearAttendance(client, 'concert-future');

    expect(cleared.error).toBeNull();
    expect(rows.find(row => row.concert_id === 'concert-future')).toBeUndefined();
    expect(rows.find(row => row.concert_id === 'concert-past')?.status).toBe('attended');
  });

  it('does not write Attendance when the Event is a festival', async () => {
    const { client, inserts } = createMockAttendanceClient({
      events: [{ id: festivalId, kind: 'festival' }],
      concerts: [{ ...futureConcert, event_id: festivalId }]
    });

    const result = await attendThisNight(client, festivalId);

    expect(result.data).toBeNull();
    expect(result.error?.ruleId).toBe(ATTENDANCE_RULE.festivalAttendAll);
    expect(result.error?.message).toBe(ATTENDANCE_RULE_MESSAGE.festivalAttendAll);
    expect(inserts).toEqual([]);
  });

  it('succeeds with an empty Bill and writes nothing', async () => {
    const { client, inserts } = createMockAttendanceClient({
      events: [{ id: nightId, kind: 'single_night' }],
      concerts: []
    });

    const result = await attendThisNight(client, nightId);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
    expect(inserts).toEqual([]);
  });
});

describe('attendance stays off pages and the store query path', () => {
  it('keeps Attendance queries in shared/domain and chips on Event and Concerts rows', () => {
    const store = readFileSync(resolve(process.cwd(), 'app/stores/events.ts'), 'utf8');
    expect(store).toMatch(/from '#shared\/domain\/attendance'/);
    expect(store).toMatch(/listMyAttendance/);
    expect(store).toMatch(/setAttendance/);
    expect(store).toMatch(/clearAttendance/);
    expect(store).toMatch(/attendThisNight/);
    expect(store).toMatch(/isAttendThisNightBusy/);
    expect(store).toMatch(/isAttendanceBusy/);
    expect(store).toMatch(/attendanceError/);
    expect(store).not.toMatch(/from\('attendance'\)/);
    expect(store).not.toMatch(/from\('attendance_effective'\)/);
    const cycleAttendance = store.slice(store.indexOf('const cycleAttendance'));
    expect(cycleAttendance).not.toMatch(/loading\.value = true/);
    expect(cycleAttendance).not.toMatch(/error\.value =/);
    const cycleEventGoing = store.slice(store.indexOf('const cycleEventGoing'));
    expect(cycleEventGoing).not.toMatch(/loading\.value = true/);
    expect(cycleEventGoing).not.toMatch(/error\.value =/);
    expect(store).toMatch(/cycleEventGoing/);
    expect(store).toMatch(/kind !== 'single_night'/);
    expect(store).toMatch(/eventGoingStatus/);
    expect(store).toMatch(/currentEvent\.value\?\.id !== eventId/);
    expect(store).toMatch(/return currentConcerts\.value/);
    const attendThisNightAction = store.slice(store.indexOf('const attendThisNight ='));
    expect(attendThisNightAction).not.toMatch(/loading\.value = true/);
    expect(attendThisNightAction).not.toMatch(/error\.value =/);

    const pageFiles = [
      'app/pages/concerts.vue',
      'app/pages/e/[id].vue',
      'app/pages/home.vue',
      'app/components/AppEventCard.vue'
    ];

    for (const file of pageFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/from\('attendance'\)/);
      expect(source).not.toMatch(/from\('attendance_effective'\)/);
      expect(source).not.toMatch(/shared\/domain\/attendance/);
    }

    const eventPage = readFileSync(resolve(process.cwd(), 'app/pages/e/[id].vue'), 'utf8');
    expect(eventPage).toMatch(/AppAttendanceChip/);
    expect(eventPage).toMatch(/isAttendanceBusy/);
    expect(eventPage).toMatch(/isEventGoingBusy/);
    expect(eventPage).toMatch(/cycleEventGoing/);
    expect(eventPage).toMatch(/showNightGoingChip/);
    expect(eventPage).toMatch(/kind === 'single_night'/);
    expect(eventPage).toMatch(/currentEvent\.kind === 'festival'/);
    expect(eventPage).not.toMatch(/Attend this night/);
    expect(eventPage).not.toMatch(/isAttendThisNightBusy/);
    expect(eventPage).not.toMatch(/Attend this festival|Mark every concert/i);
    expect(eventPage).not.toMatch(/compact card|compactCard/i);

    const concertsPage = readFileSync(resolve(process.cwd(), 'app/pages/concerts.vue'), 'utf8');
    expect(concertsPage).toMatch(/AppEventCard/);

    const eventCard = readFileSync(resolve(process.cwd(), 'app/components/AppEventCard.vue'), 'utf8');
    expect(eventCard).toMatch(/AppAttendanceChip/);
    expect(eventCard).toMatch(/isAttendanceBusy/);
    expect(eventCard).toMatch(/data-event-card/);
    expect(eventCard).toMatch(/cycleAttendance/);
    expect(eventCard).toMatch(/cycleEventGoing/);
    expect(eventCard).toMatch(/event\.kind === 'single_night'/);
    expect(eventCard).toMatch(/concerts\.length > 0/);
    expect(eventCard).toMatch(/event\.kind === 'festival'/);

    const chip = readFileSync(resolve(process.cwd(), 'app/components/AppAttendanceChip.vue'), 'utf8');
    expect(chip).toMatch(/<button/);
    expect(chip).toMatch(/h-6|h-\[24px\]/);
    expect(chip).toMatch(/Mark as going/);
    expect(chip).toMatch(/Mark as attended/);
    expect(chip).toMatch(/#FF4D8A/);
    expect(chip).toMatch(/var\(--muted\)/);
    expect(chip).toMatch(/border-dashed/);
    expect(chip).toMatch(/focus-visible/);
    expect(chip).toMatch(/motion-reduce|prefers-reduced-motion/);
    expect(chip).toMatch(/click\.stop/);
    expect(chip).not.toMatch(/bg-\[var\(--muted\)\]/);
    expect(chip).not.toMatch(/Set|On the bill|Skipped/);
  });
});

describe('eye toggle replaces the Attended chip on past concerts', () => {
  const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

  it('draws an eye button with a stable name, pressed state, and the crossed eye when not seen', () => {
    const toggle = read('app/components/AppSeenToggle.vue');
    expect(toggle).toMatch(/<button/);
    expect(toggle).toMatch(/type="button"/);
    expect(toggle).toMatch(/:aria-pressed="seen"/);
    expect(toggle).toMatch(/`Seen: \$\{props\.artist\}`/);
    expect(toggle).toMatch(/'i-lucide-eye' : 'i-lucide-eye-off'/);
    expect(toggle).toMatch(/Mark as not seen/);
    expect(toggle).toMatch(/Mark as seen/);
    expect(toggle).toMatch(/size-11/);
    expect(toggle).toMatch(/focus-visible/);
    expect(toggle).toMatch(/click\.stop/);
  });

  it('shows the eye on past rows of the card and the Event page, and keeps Going on upcoming ones', () => {
    const card = read('app/components/AppEventCard.vue');
    expect(card).toMatch(/<AppSeenToggle\s+v-if="showAttendance && eventsStore\.concertIsPast\(concert\)"/);
    expect(card).toMatch(/<AppSeenToggle\s+v-if="showAttendance && eventsStore\.concertIsPast\(row\)"/);
    expect(card).toMatch(/toggleSeen/);
    expect(card).toMatch(/concerts\.length > 0 && !nightIsPast/);

    const eventPage = read('app/pages/e/[id].vue');
    expect(eventPage).toMatch(/<AppSeenToggle\s+v-if="eventsStore\.concertIsPast\(concert\)"/);
    expect(eventPage).toMatch(/hasConcerts\.value && !nightIsPast\.value/);

    const store = read('app/stores/events.ts');
    const toggleSeen = store.slice(store.indexOf('const toggleSeen ='), store.indexOf('const attendThisNight ='));
    expect(toggleSeen).toMatch(/status: 'missed'/);
    expect(toggleSeen).toMatch(/clearAttendance/);
    expect(toggleSeen).toMatch(/wasSeen \? 'missed' : 'attended'/);
    expect(toggleSeen).toMatch(/ensureLastNightBillLoaded/);
    expect(toggleSeen).toMatch(/finally/);
  });

  it('keeps a missed concert out of souvenirs and Last night', () => {
    const night = {
      id: 'event-1',
      owner_id: 'owner-1',
      kind: 'single_night' as const,
      name: 'Past Night',
      start_date: '2026-08-10',
      end_date: '2026-08-10',
      place: 'Paris'
    };
    const stats = souvenirStats({
      events: [night],
      concerts: [{ id: 'c-seen', event_id: night.id }, { id: 'c-missed', event_id: night.id }],
      statuses: { 'c-seen': 'attended', 'c-missed': 'missed' },
      now: new Date('2026-08-19T12:00:00Z')
    });
    expect(stats.attended).toBe(1);
    expect(stats.events).toBe(1);

    expect(selectLastNightEvent(
      [night],
      [{ id: 'c-missed', event_id: night.id, date: night.start_date, time: null }],
      { 'c-missed': 'missed' }
    )).toBeNull();
  });
});
