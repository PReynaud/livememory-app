import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COPY_LINK_FAILED } from '../../app/utils/copy-link';
import {
  getSharedListConcerts,
  getSharedListProfile,
  groupSharedListEvents,
  SHARED_LIST_EMPTY,
  SHARED_LIST_HELPER,
  SHARED_LIST_NOT_FOUND,
  type SharedListClient,
  type SharedListConcertRow,
  type SharedListProfile
} from '../../shared/domain/shared-list';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

const readSharingMigration = () => {
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql') && name.includes('shared_list_enable'))
    .sort();

  expect(files.length).toBe(1);
  return readFileSync(resolve(migrationsDir, files[0]!), 'utf8');
};

const readConcertsMigration = () => {
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql') && name.includes('shared_list_concerts'))
    .sort();

  expect(files.length).toBe(1);
  return readFileSync(resolve(migrationsDir, files[0]!), 'utf8');
};

const concertRow = (overrides: Partial<SharedListConcertRow> = {}): SharedListConcertRow => ({
  event_id: 'event-1',
  event_name: 'Night One',
  event_kind: 'single_night',
  start_date: '2026-09-01',
  end_date: '2026-09-01',
  event_place: 'Paris',
  concert_id: 'concert-1',
  artist: 'Justice',
  concert_date: '2026-09-01',
  concert_time: null,
  concert_place: 'Paris',
  stage_id: null,
  stage_name: null,
  ...overrides
});

const createLookupClient = (
  rows: SharedListProfile[] | SharedListProfile | null,
  error: { message: string } | null = null
): SharedListClient => ({
  rpc: async (fn, args) => {
    expect(fn).toBe('get_shared_list_profile');
    expect(args.requested).toBeTruthy();
    return { data: rows, error };
  }
});

const createConcertsClient = (
  rows: SharedListConcertRow[] | SharedListConcertRow | null,
  error: { message: string } | null = null
): SharedListClient => ({
  rpc: async (fn, args) => {
    expect(fn).toBe('get_shared_list_concerts');
    expect(args.requested).toBeTruthy();
    return { data: rows, error };
  }
});

describe('shared list kernel', () => {
  it('persists sharing off by default and looks up one enabled username, not a directory', () => {
    const sql = readSharingMigration();

    expect(sql).toMatch(/add column shared_list_enabled boolean not null default false/);
    expect(sql).toMatch(/create view public\.shared_list_profiles/);
    expect(sql).toMatch(/security_invoker = false/);
    expect(sql).toMatch(/where profiles\.shared_list_enabled/);
    expect(sql).toMatch(/lower\(profiles\.username\) as username_key/);
    expect(sql).toMatch(/revoke all on table public\.shared_list_profiles from public, anon, authenticated/);
    expect(sql).toMatch(/create or replace function public\.get_shared_list_profile\(requested text\)/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/username_key = lower\(btrim\(requested\)\)/);
    expect(sql).toMatch(/grant execute on function public\.get_shared_list_profile\(text\) to anon, authenticated/);
    expect(sql).not.toMatch(/grant select on table public\.shared_list_profiles/);
    expect(sql).toMatch(/grant select, insert, update on table public\.profiles to authenticated/);
    expect(sql).toMatch(/revoke select, insert, update, delete on table public\.profiles from anon/);
    expect(sql).not.toMatch(/service_role/);
  });

  it('looks up one User\'s effective going/attended Concerts, not a directory', () => {
    const sql = readConcertsMigration();

    expect(sql).toMatch(/create view public\.shared_list_concerts/);
    expect(sql).toMatch(/security_invoker = false/);
    expect(sql).toMatch(/where profiles\.shared_list_enabled/);
    expect(sql).toMatch(/concert_is_past/);
    expect(sql).toMatch(/join public\.attendance/);
    expect(sql).not.toMatch(/concerts\.notes/);
    expect(sql).toMatch(/revoke all on table public\.shared_list_concerts from public, anon, authenticated/);
    expect(sql).toMatch(/create or replace function public\.get_shared_list_concerts\(requested text\)/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/username_key = lower\(btrim\(requested\)\)/);
    expect(sql).toMatch(/grant execute on function public\.get_shared_list_concerts\(text\) to anon, authenticated/);
    expect(sql).not.toMatch(/grant select on table public\.shared_list_concerts/);
    expect(sql).not.toMatch(/service_role/);
  });
});

describe('getSharedListProfile', () => {
  it('returns the enabled username and treats missing rows as quiet not-found', async () => {
    const found = await getSharedListProfile(
      createLookupClient([{ username: 'Pierre' }]),
      'Pierre'
    );

    expect(found.error).toBeNull();
    expect(found.data).toEqual({ username: 'Pierre' });

    const missing = await getSharedListProfile(createLookupClient([]), 'ghost');
    expect(missing.error).toBeNull();
    expect(missing.data).toBeNull();
  });

  it('matches username case-insensitively without treating underscore as a wildcard', async () => {
    let requested = '';
    const result = await getSharedListProfile(
      {
        rpc: async (fn, args) => {
          expect(fn).toBe('get_shared_list_profile');
          requested = args.requested;
          return { data: [{ username: 'a_b' }], error: null };
        }
      },
      'A_B'
    );

    expect(requested).toBe('A_B');
    expect(result.data).toEqual({ username: 'a_b' });
  });
});

describe('getSharedListConcerts', () => {
  it('groups one Concert as compact and two as an Event group', async () => {
    const compact = groupSharedListEvents([concertRow()]);
    expect(compact).toHaveLength(1);
    expect(compact[0]?.concerts).toHaveLength(1);
    expect(compact[0]?.event.name).toBe('Night One');
    expect(compact[0]?.concerts[0]?.artist).toBe('Justice');
    expect(compact[0]?.concerts[0]?.stage_name).toBeNull();

    const grouped = await getSharedListConcerts(
      createConcertsClient([
        concertRow({ concert_id: 'c1', artist: 'A' }),
        concertRow({ concert_id: 'c2', artist: 'B' })
      ]),
      'Pierre'
    );

    expect(grouped.error).toBeNull();
    expect(grouped.data).toHaveLength(1);
    expect(grouped.data?.[0]?.concerts.map(row => row.artist)).toEqual(['A', 'B']);
  });

  it('keeps separate Events as separate groups and returns empty for no rows', async () => {
    const listed = groupSharedListEvents([
      concertRow({ event_id: 'owned', event_name: 'Mine', concert_id: 'c1' }),
      concertRow({
        event_id: 'joined',
        event_name: 'Theirs',
        concert_id: 'c2',
        artist: 'Guest'
      })
    ]);

    expect(listed.map(group => group.event.name)).toEqual(['Mine', 'Theirs']);
    expect(listed[1]?.concerts[0]?.artist).toBe('Guest');

    const empty = await getSharedListConcerts(createConcertsClient([]), 'Pierre');
    expect(empty.error).toBeNull();
    expect(empty.data).toEqual([]);
  });
});

describe('shared list surfaces', () => {
  it('keeps Profile toggle and copy on the store, and quiet not-found on /u/:username', () => {
    const nuxt = read('nuxt.config.ts');
    expect(nuxt).toMatch(/'\/u\/\*\*'/);
    expect(nuxt).toMatch(/'\/api\/\*\*'/);
    expect(nuxt).toMatch(/'\/\.well-known\/\*\*'/);

    const profilePage = read('app/pages/profile.vue');
    expect(profilePage).toMatch(/sharedListEnabled/);
    expect(profilePage).toMatch(/setSharedListEnabled/);
    expect(profilePage).toMatch(/Copy link/);
    expect(profilePage).toMatch(/color="primary"/);
    expect(profilePage).toMatch(/variant="outline"/);
    expect(profilePage).toMatch(/COPY_LINK_FAILED/);
    expect(COPY_LINK_FAILED).toBe('Couldn\'t copy the link.');
    expect(profilePage).toMatch(/SHARED_LIST_HELPER/);
    expect(SHARED_LIST_HELPER).toBe(
      'Friends see Going and Attended. They can open an Event to join — they never edit your bill or see notes.'
    );
    expect(profilePage).not.toMatch(/from\('profiles'\)/);
    expect(profilePage).not.toMatch(/directory|User search|find users/i);

    const store = read('app/stores/profile.ts');
    expect(store).toMatch(/shared_list_enabled/);
    expect(store).toMatch(/setSharedListEnabled/);
    expect(store).toMatch(/auth\.getUser/);
    expect(store).toMatch(/finally/);

    const publicPage = read('app/pages/u/[username].vue');
    expect(publicPage).toMatch(/SHARED_LIST_NOT_FOUND/);
    expect(publicPage).toMatch(/SHARED_LIST_EMPTY/);
    expect(SHARED_LIST_NOT_FOUND).toBe('Not found.');
    expect(SHARED_LIST_EMPTY).toBe('Nothing to show yet.');
    expect(publicPage).toMatch(/fetchPublicProfile/);
    expect(publicPage).toMatch(/AppEventCard/);
    expect(publicPage).toMatch(/readonly/);
    expect(publicPage).toMatch(/shared-list-empty/);
    expect(publicPage).not.toMatch(/from\('events'\)|from\('concerts'\)|from\('profiles'\)|from\('attendance'\)/);
    expect(publicPage).not.toMatch(/Add concert|label="Add"/);
    expect(publicPage).not.toMatch(/AppAttendanceChip|cycleAttendance|Edit event|Delete/);
    expect(publicPage).toMatch(/Shared list for \{\{ profile\.username \}\}/);
    expect(publicPage).toMatch(/shared-list-load-error/);
    expect(publicPage).not.toMatch(/bill-only|missing notes|no notes/i);

    const publicStore = read('app/stores/shared-list.ts');
    expect(publicStore).toMatch(/getSharedListProfile/);
    expect(publicStore).toMatch(/getSharedListConcerts/);
    expect(publicStore).toMatch(/finally/);

    const card = read('app/components/AppEventCard.vue');
    expect(card).toMatch(/readonly\?: boolean/);
    expect(card).toMatch(/v-if="!readonly"/);
    expect(card).toMatch(/eventPath/);
    expect(card).toMatch(/:href="eventPath"/);
    expect(card).toMatch(/:to="eventPath"/);
  });

  it('has no User directory or search of Users', () => {
    const pagesDir = resolve(process.cwd(), 'app/pages');
    const pageFiles = readdirSync(pagesDir, { recursive: true })
      .map(name => String(name))
      .filter(name => name.endsWith('.vue'));

    expect(pageFiles.some(name => /search|users|directory/i.test(name))).toBe(false);

    for (const file of pageFiles) {
      const source = read(`app/pages/${file}`);
      expect(source).not.toMatch(/search users|User directory|Find a user|Browse users/i);
    }

    expect(read('app/pages/profile.vue')).not.toMatch(/type="search"/);
  });
});
