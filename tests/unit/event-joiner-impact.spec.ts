import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  concertMoveWouldLoseJoiners,
  eventHasJoiners,
  JOINER_IMPACT_COPY,
  MEMBERSHIP_RULE
} from '../../shared/domain/membership';
import type { EventsClient } from '../../shared/domain/events';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

const readImpactMigration = () => {
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql') && name.includes('event_joiner_impact'))
    .sort();

  expect(files.length).toBe(1);
  return readFileSync(resolve(migrationsDir, files[0]!), 'utf8');
};

const SOURCE = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';

const createImpactClient = (options?: {
  hasJoiners?: boolean;
  moveWouldLose?: boolean;
  error?: { message: string };
}) => {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (options?.error) {
        return { data: null, error: options.error };
      }

      if (fn === 'event_has_joiners') {
        return { data: options?.hasJoiners ?? false, error: null };
      }

      if (fn === 'concert_move_would_lose_joiners') {
        return { data: options?.moveWouldLose ?? false, error: null };
      }

      return { data: null, error: { message: `unexpected rpc ${fn}` } };
    }
  };

  return {
    client: client as unknown as EventsClient,
    rpcCalls
  };
};

describe('joiner-impact kernel', () => {
  it('exposes owner-only boolean RPCs and does not grant a roster', () => {
    const sql = readImpactMigration();

    expect(sql).toMatch(/create or replace function public\.event_has_joiners\(p_event_id uuid\)/);
    expect(sql).toMatch(/create or replace function public\.concert_move_would_lose_joiners\(/);
    expect(sql).toMatch(/returns boolean/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/events\.owner_id = \(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/not exists \(/);
    expect(sql).toMatch(/revoke all on function public\.event_has_joiners\(uuid\) from public/);
    expect(sql).toMatch(/grant execute on function public\.event_has_joiners\(uuid\) to authenticated/);
    expect(sql).toMatch(
      /revoke all on function public\.concert_move_would_lose_joiners\(uuid, uuid\) from public/
    );
    expect(sql).toMatch(
      /grant execute on function public\.concert_move_would_lose_joiners\(uuid, uuid\) to authenticated/
    );
    expect(sql).not.toMatch(/grant select on table public\.event_members/);
    expect(sql).not.toMatch(/service_role/);
    expect(sql).not.toMatch(/username/);
    expect(sql).not.toMatch(/returns table/i);
  });
});

describe('eventHasJoiners', () => {
  it('calls the boolean RPC and treats a blank id as no joiners', async () => {
    const { client, rpcCalls } = createImpactClient({ hasJoiners: true });

    const found = await eventHasJoiners(client, ` ${SOURCE} `);
    expect(found).toEqual({ data: true, error: null });
    expect(rpcCalls).toEqual([{ fn: 'event_has_joiners', args: { p_event_id: SOURCE } }]);

    const empty = await eventHasJoiners(createImpactClient({ hasJoiners: true }).client, '  ');
    expect(empty).toEqual({ data: false, error: null });
  });

  it('returns a domain error when the lookup fails', async () => {
    const failed = await eventHasJoiners(
      createImpactClient({ error: { message: 'lookup failed' } }).client,
      SOURCE
    );

    expect(failed.data).toBeNull();
    expect(failed.error).toEqual({
      ruleId: MEMBERSHIP_RULE.joinerImpactLookupFailed,
      message: 'lookup failed'
    });
  });
});

describe('concertMoveWouldLoseJoiners', () => {
  it('calls the source/target boolean RPC', async () => {
    const { client, rpcCalls } = createImpactClient({ moveWouldLose: true });

    const impact = await concertMoveWouldLoseJoiners(client, ` ${SOURCE} `, ` ${TARGET} `);
    expect(impact).toEqual({ data: true, error: null });
    expect(rpcCalls).toEqual([{
      fn: 'concert_move_would_lose_joiners',
      args: {
        p_source_event_id: SOURCE,
        p_target_event_id: TARGET
      }
    }]);

    const missing = await concertMoveWouldLoseJoiners(
      createImpactClient({ moveWouldLose: true }).client,
      SOURCE,
      ''
    );
    expect(missing).toEqual({ data: false, error: null });
  });
});

describe('joiner-impact copy and wiring', () => {
  it('names Concert, Event, Attendance, and Bill impact without a roster', () => {
    expect(JOINER_IMPACT_COPY.deleteConcert).toBe(
      'Joiners will lose this Concert and their Attendance on it.'
    );
    expect(JOINER_IMPACT_COPY.moveConcert).toMatch(/Bill/);
    expect(JOINER_IMPACT_COPY.moveConcert).toMatch(/not be added to the target Event/);
    expect(JOINER_IMPACT_COPY.deleteEvent).toBe(
      'Joiners will lose this Event, its Concerts, and their Attendance.'
    );
    expect(JOINER_IMPACT_COPY.deleteEmptyEvent).toBe('Joiners will lose this Event.');
    expect(JOINER_IMPACT_COPY.deleteEmptyEvent).not.toMatch(/Concert/);
  });

  it('keeps lookup and copy in the store and owner sheets, not pages', () => {
    const store = read('app/stores/events.ts');
    expect(store).toMatch(/lookupEventHasJoiners/);
    expect(store).toMatch(/lookupConcertMoveWouldLoseJoiners/);
    expect(store).toMatch(/const eventHasJoiners = async/);
    expect(store).toMatch(/const concertMoveWouldLoseJoiners = async/);
    expect(store).toMatch(/return \{ data: result\.data, error: null \}/);
    expect(store).not.toMatch(/from\('event_members'\)/);
    expect(store).not.toMatch(/rpc\('event_has_joiners'/);

    const concertSheet = read('app/components/AppAddConcertSheet.vue');
    expect(concertSheet).toMatch(/JOINER_IMPACT_COPY\.deleteConcert/);
    expect(concertSheet).toMatch(/JOINER_IMPACT_COPY\.moveConcert/);
    expect(concertSheet).toMatch(/eventsStore\.eventHasJoiners/);
    expect(concertSheet).toMatch(/eventsStore\.concertMoveWouldLoseJoiners/);
    expect(concertSheet).toMatch(/confirmMove/);
    expect(concertSheet).toMatch(/label="Move concert"/);
    expect(concertSheet).not.toMatch(/from\('event_members'\)/);
    expect(concertSheet).not.toMatch(/rpc\('event_has_joiners'/);

    const eventSheet = read('app/components/AppEditEventSheet.vue');
    expect(eventSheet).toMatch(/JOINER_IMPACT_COPY\.deleteEvent/);
    expect(eventSheet).toMatch(/JOINER_IMPACT_COPY\.deleteEmptyEvent/);
    expect(eventSheet).toMatch(/eventsStore\.eventHasJoiners/);
    expect(eventSheet).toMatch(/!hasConcerts\.value && !deleteHasJoiners\.value/);
    expect(eventSheet).not.toMatch(/from\('event_members'\)/);

    for (const file of ['app/pages/e/[id].vue', 'app/pages/home.vue', 'app/pages/concerts.vue']) {
      const source = read(file);
      expect(source).not.toMatch(/eventHasJoiners/);
      expect(source).not.toMatch(/JOINER_IMPACT_COPY/);
      expect(source).not.toMatch(/from\('event_members'\)/);
    }
  });

  it('waits for joiner Home after owner sign-out instead of racing a second navigation', () => {
    const e2e = read('tests/e2e/event-joiner-impact.spec.ts');
    expect(e2e).toMatch(/signInOnPage\(page, joiner\);\s*await expect\(page\)\.toHaveURL\(\/\\\/home\/\)/);
    expect(e2e).not.toMatch(/signInOnPage\(page, joiner\);\s*await page\.goto\('\/home'\)/);
    expect(read('app/stores/auth.ts')).toMatch(/redirect: '\/home'/);
  });
});
