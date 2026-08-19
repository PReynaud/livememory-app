import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { souvenirStats } from '../../shared/domain/home';
import { joinEvent, type EventMemberRecord } from '../../shared/domain/membership';
import { CONCERT_VISIBLE_COLUMNS } from '../../shared/domain/concerts';
import type { EventsClient } from '../../shared/domain/events';
import { COPY_LINK_FAILED } from '../../app/utils/copy-link';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

const readJoinMigration = () => {
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql') && name.includes('event_members_join'))
    .sort();

  expect(files.length).toBe(1);
  return readFileSync(resolve(migrationsDir, files[0]!), 'utf8');
};

const createJoinClient = (options?: {
  insertError?: { message: string; code?: string; details?: string; hint?: string };
  members?: EventMemberRecord[];
}) => {
  const members = [...(options?.members ?? [])];
  const insertCalls: Record<string, unknown>[] = [];

  const client = {
    from: (_table: 'event_members') => ({
      insert: (row: Record<string, unknown>) => {
        insertCalls.push(row);
        return {
          select: () => ({
            single: async () => {
              if (options?.insertError) {
                return { data: null, error: options.insertError };
              }

              const created: EventMemberRecord = {
                id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(members.length).padStart(12, '0')}`,
                event_id: String(row.event_id),
                user_id: 'joiner-1'
              };
              members.push(created);
              return { data: created, error: null };
            }
          })
        };
      }
    })
  };

  return {
    client: client as unknown as EventsClient,
    insertCalls,
    members
  };
};

describe('event_members kernel', () => {
  it('adds membership without storing the owner, with member SELECT and owner-only notes', () => {
    const sql = readJoinMigration();

    expect(sql).toMatch(/create table public\.event_members/);
    expect(sql).toMatch(/event_id uuid not null references public\.events \(id\) on delete cascade/);
    expect(sql).toMatch(/user_id uuid not null default auth\.uid\(\) references auth\.users \(id\) on delete cascade/);
    expect(sql).toMatch(/constraint event_members_event_user_key unique \(event_id, user_id\)/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/grant select, insert on table public\.event_members to authenticated/);
    expect(sql).toMatch(/if owner is null or owner = new\.user_id then/);
    expect(sql).toMatch(/raise exception 'Event not found'/);
    expect(sql).toMatch(/owned or joined events/);
    expect(sql).toMatch(/select concerts on visible events/);
    expect(sql).toMatch(/revoke select on table public\.concerts from authenticated/);
    expect(sql).toMatch(/grant select \(/);
    expect(sql).not.toMatch(/grant select \([^;]*notes[^;]*\) on table public\.concerts/s);
    expect(sql).toMatch(/create or replace view public\.concert_notes/);
    expect(sql).toMatch(/concerts\.owner_id = \(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/grant select on table public\.concert_notes to authenticated/);
    expect(sql).toMatch(/grant update \(notes\) on table public\.concert_notes to authenticated/);
    expect(sql).toMatch(/create or replace function public\.assert_event_bill_valid/);
    expect(sql).toMatch(/concert\.notes := null/);
    expect(sql).not.toMatch(/select \*\s+from public\.concerts/);
    expect(sql).not.toMatch(/service_role/);
    expect(sql).not.toMatch(/for delete/);
  });

  it('loads Concerts without selecting revoked notes', () => {
    const domain = read('shared/domain/concerts.ts');
    expect(domain).toContain('export const CONCERT_VISIBLE_COLUMNS');
    expect(domain).not.toMatch(/from\('concerts'\)\.select\('\*'\)/);
    expect(domain).not.toMatch(/from\('concerts'\)[\s\S]{0,160}\.select\(\)/);
    expect(read('shared/domain/events.ts')).not.toMatch(/from\('concerts'\)\s*\.select\('\*'\)/);
    expect(CONCERT_VISIBLE_COLUMNS.split(',')).toEqual([
      'id',
      'event_id',
      'owner_id',
      'artist',
      'date',
      'time',
      'place',
      'stage_id'
    ]);
    expect(CONCERT_VISIBLE_COLUMNS).not.toMatch(/notes/);
  });
});

describe('joinEvent', () => {
  it('inserts event_id only and treats unique membership as view, not a second join', async () => {
    const { client, insertCalls } = createJoinClient();

    const first = await joinEvent(client, ' 11111111-1111-4111-8111-111111111111 ');
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({
      event_id: '11111111-1111-4111-8111-111111111111',
      user_id: 'joiner-1'
    });
    expect(insertCalls).toEqual([{ event_id: '11111111-1111-4111-8111-111111111111' }]);

    const again = await joinEvent(
      createJoinClient({
        insertError: { code: '23505', message: 'duplicate key value violates unique constraint' }
      }).client,
      '11111111-1111-4111-8111-111111111111'
    );
    expect(again.error).toBeNull();
    expect(again.data).toBe(true);
  });

  it('maps owner or unknown Event to quiet not-found', async () => {
    const missing = await joinEvent(
      createJoinClient({ insertError: { message: 'Event not found' } }).client,
      '00000000-0000-4000-8000-000000000000'
    );
    expect(missing).toEqual({ data: null, error: null });

    const owner = await joinEvent(
      createJoinClient({
        insertError: { message: 'Event not found', details: 'owner cannot join' }
      }).client,
      '11111111-1111-4111-8111-111111111111'
    );
    expect(owner).toEqual({ data: null, error: null });

    const malformed = await joinEvent(
      createJoinClient({
        insertError: { code: '22P02', message: 'invalid input syntax for type uuid' }
      }).client,
      'not-a-uuid'
    );
    expect(malformed).toEqual({ data: null, error: null });
  });
});

describe('join surfaces', () => {
  it('opens Event as join-once, copies the URL quietly, and keeps confirm redirect', () => {
    const store = read('app/stores/events.ts');
    const fetchEvent = store.slice(store.indexOf('const fetchEvent ='), store.indexOf('const createOwnedEvent ='));
    expect(fetchEvent).toMatch(/getOwnedEvent/);
    expect(fetchEvent).toMatch(/joinEvent/);
    expect(fetchEvent.indexOf('getOwnedEvent')).toBeLessThan(fetchEvent.indexOf('joinEvent'));
    expect(fetchEvent).toMatch(/if \(joined\.data\)/);
    expect(store).toMatch(/auth\.getUser/);
    expect(store).toMatch(/isOwner\.value = Boolean\(data\.user\?\.id && data\.user\.id === event\.owner_id\)/);

    const page = read('app/pages/e/[id].vue');
    expect(page).toMatch(/isOwner/);
    expect(page).not.toMatch(/useSupabaseUser/);
    expect(page).toMatch(/Copy link/);
    expect(page).toMatch(/copyEventLink/);
    expect(page).toMatch(/COPY_LINK_FAILED/);
    expect(page).not.toMatch(/share sheet|Share sheet|invite modal|Invite friends|directory/i);
    expect(page).toMatch(/v-if="isOwner"/);
    expect(page).toMatch(/Edit event/);
    expect(page).toMatch(/Add to this night|billCtaLabel/);

    const confirm = read('app/pages/confirm.vue');
    expect(confirm).toMatch(/getSafeInternalPath\(route\.query\.redirect\)/);
    expect(read('app/utils/safe-redirect.ts')).toMatch(/fallback = '\/home'/);

    const auth = read('app/middleware/auth.ts');
    expect(auth).toMatch(/path: '\/login'/);
    expect(auth).toMatch(/redirect: to\.fullPath/);
  });

  it('counts owned plus joined Events in souvenir stats', () => {
    expect(souvenirStats({
      eventCount: 2,
      statuses: ['going', 'attended']
    })).toEqual({
      attended: 1,
      events: 2,
      going: 1
    });
    expect(COPY_LINK_FAILED).toBe('Couldn\'t copy the link.');
  });
});
