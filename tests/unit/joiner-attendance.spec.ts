import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  attendThisNight,
  clearAttendance,
  setAttendance,
  type AttendanceClient,
  type AttendanceRecord
} from '../../shared/domain/attendance';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const createAttendanceClient = (rows: AttendanceRecord[] = []) => {
  const stored = [...rows];
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const deletes: string[] = [];

  const client = {
    from: (relation: 'attendance' | 'attendance_effective' | 'events' | 'concerts') => {
      if (relation === 'events') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'event-1', kind: 'single_night' as const },
                error: null
              })
            })
          })
        };
      }

      if (relation === 'concerts') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'concert-1', date: '2026-12-01', time: null },
                  { id: 'concert-2', date: '2026-12-01', time: null }
                ],
                error: null
              })
            })
          })
        };
      }

      if (relation === 'attendance_effective') {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: stored.find(row => row.concert_id === value) ?? null,
                error: null
              })
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
                const created: AttendanceRecord = {
                  id: `att-${stored.length + 1}`,
                  user_id: 'joiner-1',
                  concert_id: String(row.concert_id),
                  status: row.status === 'attended' ? 'attended' : 'going'
                };
                stored.push(created);
                return { data: created, error: null };
              }
            })
          };
        },
        select: () => ({
          eq: (_column: string, value: string) => ({
            maybeSingle: async () => ({
              data: stored.find(row => row.concert_id === value) ?? null,
              error: null
            })
          })
        }),
        update: (row: Record<string, unknown>) => {
          updates.push(row);
          return {
            eq: (_column: string, value: string) => ({
              select: () => ({
                single: async () => {
                  const index = stored.findIndex(entry => entry.concert_id === value);
                  if (index < 0) {
                    return { data: null, error: { message: 'missing' } };
                  }

                  stored[index] = {
                    ...stored[index]!,
                    status: row.status === 'attended' ? 'attended' : 'going'
                  };
                  return { data: stored[index]!, error: null };
                }
              })
            })
          };
        },
        delete: () => ({
          eq: async (_column: string, value: string) => {
            deletes.push(value);
            const index = stored.findIndex(entry => entry.concert_id === value);
            if (index >= 0) {
              stored.splice(index, 1);
            }
            return { data: null, error: null };
          }
        })
      };
    }
  };

  return {
    client: client as unknown as AttendanceClient,
    stored,
    inserts,
    updates,
    deletes
  };
};

describe('joiner Event attendance surface', () => {
  it('shows own chips and Attend this night, and hides Bill writes and notes', () => {
    const page = read('app/pages/e/[id].vue');

    expect(page).toMatch(/AppAttendanceChip/);
    expect(page).toMatch(/cycleAttendance/);
    expect(page).not.toMatch(/v-if="isOwner"\s*\n\s*:status="eventsStore.attendanceStatus"/);
    expect(page).toMatch(/v-if="showAttendThisNight"/);
    expect(page).not.toMatch(/isOwner && showAttendThisNight/);
    expect(page).toMatch(/v-if="isOwner"/);
    expect(page).toMatch(/Edit event/);
    expect(page).toMatch(/billCtaLabel/);
    expect(page).toMatch(/openEditSheet/);
    expect(page).not.toMatch(/Leave Event/);
    expect(page).not.toMatch(/label="Notes"|name="notes"/);
    expect(page).not.toMatch(/concert\.notes|currentEvent\.notes/);
  });

  it('offers only owned Events in the Add Concert picker', () => {
    const sheet = read('app/components/AppAddConcertSheet.vue');
    expect(sheet).toMatch(/sessionUserId/);
    expect(sheet).toMatch(/event\.owner_id === sessionUserId\.value/);
    expect(sheet).not.toMatch(/useSupabaseUser/);
    expect(sheet).not.toMatch(/joiner/i);
  });

  it('loads Concerts without the owner notes column', () => {
    const concerts = read('shared/domain/concerts.ts');
    expect(concerts).toMatch(/CONCERT_VISIBLE_COLUMNS/);
    expect(concerts).toMatch(/id,event_id,owner_id,artist,date,time,place,stage_id/);
    expect(concerts).not.toMatch(/from\('concerts'\)[\s\S]{0,80}select\('\*'\)/);
  });
});

describe('joiner Attendance writes', () => {
  it('sets, changes, and clears only the acting User row', async () => {
    const { client, stored, inserts } = createAttendanceClient();

    const set = await setAttendance(client, { concertId: 'concert-1', status: 'going' });
    expect(set.error).toBeNull();
    expect(set.data?.user_id).toBe('joiner-1');
    expect(set.data?.status).toBe('going');
    expect(inserts).toEqual([{ concert_id: 'concert-1', status: 'going' }]);
    expect(stored).toHaveLength(1);

    const again = await setAttendance(client, { concertId: 'concert-1', status: 'going' });
    expect(again.error).toBeNull();
    expect(stored).toHaveLength(1);

    const cleared = await clearAttendance(client, 'concert-1');
    expect(cleared.error).toBeNull();
    expect(stored).toHaveLength(0);
  });

  it('attend-all writes the acting User on current Bill Concerts', async () => {
    const { client, stored } = createAttendanceClient();
    const result = await attendThisNight(client, 'event-1', new Date('2026-08-01T12:00:00Z'));

    expect(result.error).toBeNull();
    expect(result.data?.map(row => row.concert_id).sort()).toEqual(['concert-1', 'concert-2']);
    expect(stored.every(row => row.user_id === 'joiner-1')).toBe(true);
    expect(stored.every(row => row.status === 'going')).toBe(true);
  });
});
