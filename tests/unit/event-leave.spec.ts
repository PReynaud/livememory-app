import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  leaveEvent,
  MEMBERSHIP_RULE,
  MEMBERSHIP_RULE_MESSAGE,
  type EventMemberRecord
} from '../../shared/domain/membership';
import type { EventsClient } from '../../shared/domain/events';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

const readLeaveMigration = () => {
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql') && name.includes('event_members_leave'))
    .sort();

  expect(files.length).toBe(1);
  return readFileSync(resolve(migrationsDir, files[0]!), 'utf8');
};

const EVENT_ID = '11111111-1111-4111-8111-111111111111';

const createLeaveClient = (options?: {
  event?: { id: string; owner_id: string } | null;
  eventError?: { message: string; code?: string };
  member?: EventMemberRecord | null;
  memberError?: { message: string; code?: string };
  deleteError?: { message: string; code?: string };
}) => {
  const deleteCalls: Array<{ column: string; value: string }> = [];

  const client = {
    from: (table: 'events' | 'event_members') => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: options?.event === undefined
                  ? { id: EVENT_ID, owner_id: 'owner-1' }
                  : options.event,
                error: options?.eventError ?? null
              })
            })
          })
        };
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: options?.member === undefined
                ? {
                    id: 'member-1',
                    event_id: EVENT_ID,
                    user_id: 'joiner-1'
                  }
                : options.member,
              error: options?.memberError ?? null
            })
          })
        }),
        delete: () => ({
          eq: async (column: string, value: string) => {
            deleteCalls.push({ column, value });
            return { data: null, error: options?.deleteError ?? null };
          }
        })
      };
    }
  };

  return {
    client: client as unknown as EventsClient,
    deleteCalls
  };
};

describe('event_members leave kernel', () => {
  it('lets a joiner delete own membership and clears their Attendance on that Event', () => {
    const sql = readLeaveMigration();

    expect(sql).toMatch(/grant delete on table public\.event_members to authenticated/);
    expect(sql).toMatch(/for delete/);
    expect(sql).toMatch(/to authenticated/);
    expect(sql).toMatch(/\(select auth\.uid\(\)\) = user_id/);
    expect(sql).toMatch(/create trigger event_members_leave_attendance/);
    expect(sql).toMatch(/before delete on public\.event_members/);
    expect(sql).toMatch(/delete from public\.attendance/);
    expect(sql).toMatch(/attendance\.user_id = old\.user_id/);
    expect(sql).toMatch(/concerts\.event_id = old\.event_id/);
    expect(sql).toMatch(/security invoker/);
    expect(sql).toMatch(/revoke execute on function public\.event_members_leave_attendance/);
    expect(sql).not.toMatch(/service_role/);
    expect(sql).not.toMatch(/grant update/);
    expect(sql).not.toMatch(/grant all/i);
  });

  it('keeps join migration insert-only', () => {
    const joinSql = readFileSync(
      resolve(migrationsDir, '20260819191455_event_members_join.sql'),
      'utf8'
    );
    expect(joinSql).toMatch(/grant select, insert on table public\.event_members to authenticated/);
    expect(joinSql).not.toMatch(/for delete/);
  });
});

describe('leaveEvent', () => {
  it('deletes the joiner membership row for that Event', async () => {
    const { client, deleteCalls } = createLeaveClient();

    const result = await leaveEvent(client, ` ${EVENT_ID} `);

    expect(result).toEqual({ data: true, error: null });
    expect(deleteCalls).toEqual([{ column: 'event_id', value: EVENT_ID }]);
  });

  it('refuses when the Event is visible without membership (owner)', async () => {
    const { client, deleteCalls } = createLeaveClient({ member: null });

    const result = await leaveEvent(client, EVENT_ID);

    expect(result).toEqual({
      data: null,
      error: {
        ruleId: MEMBERSHIP_RULE.ownerCannotLeave,
        message: MEMBERSHIP_RULE_MESSAGE.ownerCannotLeave
      }
    });
    expect(deleteCalls).toEqual([]);
  });

  it('maps unknown Event to quiet not-found', async () => {
    const missing = await leaveEvent(
      createLeaveClient({ event: null }).client,
      EVENT_ID
    );
    expect(missing).toEqual({ data: null, error: null });

    const blank = await leaveEvent(createLeaveClient().client, '  ');
    expect(blank).toEqual({ data: null, error: null });

    const malformed = await leaveEvent(
      createLeaveClient({
        event: null,
        eventError: { code: '22P02', message: 'invalid input syntax for type uuid' }
      }).client,
      'not-a-uuid'
    );
    expect(malformed).toEqual({ data: null, error: null });
  });

  it('maps persist failures on membership delete', async () => {
    const result = await leaveEvent(
      createLeaveClient({ deleteError: { message: 'permission denied' } }).client,
      EVENT_ID
    );
    expect(result).toEqual({
      data: null,
      error: {
        ruleId: MEMBERSHIP_RULE.leaveFailed,
        message: 'permission denied'
      }
    });
  });
});

describe('leave surfaces', () => {
  it('exposes leaveJoinedEvent next to domain leaveEvent and reloads lists', () => {
    const store = read('app/stores/events.ts');
    const leaveFn = store.slice(
      store.indexOf('const leaveJoinedEvent ='),
      store.indexOf('const cycleAttendance =')
    );
    expect(leaveFn).toMatch(/leaveEvent/);
    expect(leaveFn).toMatch(/offlineWriteError/);
    expect(leaveFn).toMatch(/reloadOwnedConcertState/);
    expect(leaveFn).toMatch(/error: null/);
    expect(leaveFn).toMatch(/loading\.value = false/);
    expect(store).toMatch(/leaveJoinedEvent,/);
  });

  it('shows a quiet Leave Event confirm for joiners only', () => {
    const page = read('app/pages/e/[id].vue');
    expect(page).toMatch(/label="Leave Event"/);
    expect(page).toMatch(/v-if="!isOwner && !confirmLeave"/);
    expect(page).toMatch(/color="neutral"/);
    expect(page).toMatch(/variant="link"/);
    expect(page).toMatch(/Leave this Event\? It will leave your list\. The bill stays for the owner\./);
    expect(page).toMatch(/leaveJoinedEvent/);
    expect(page).toMatch(/navigateTo\('\/concerts'\)/);
    expect(page).toMatch(/label="Leave"/);
    expect(page).toMatch(/color="error"/);
    expect(page).not.toMatch(/label="Leave Event"[\s\S]{0,120}color="primary"/);
    expect(page).not.toMatch(/label="Leave Event"[\s\S]{0,200}button-primary/);
    expect(page).not.toMatch(/Shared List|joiner impact/i);
  });
});
