import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COPY_LINK_FAILED } from '../../app/utils/copy-link';
import {
  getSharedListProfile,
  SHARED_LIST_EMPTY,
  SHARED_LIST_HELPER,
  SHARED_LIST_NOT_FOUND,
  type SharedListClient,
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
    expect(sql).toMatch(/revoke all on table public\.profiles from anon/);
    expect(sql).toMatch(/grant select, insert on table public\.profiles to authenticated/);
    expect(sql).toMatch(/grant update \(shared_list_enabled\) on table public\.profiles to authenticated/);
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

describe('shared list surfaces', () => {
  it('keeps Profile toggle and copy on the store, and quiet not-found on /u/:username', () => {
    const nuxt = read('nuxt.config.ts');
    expect(nuxt).toMatch(/exclude: \['\/', '\/login', '\/confirm', '\/u\/\*\*'\]/);

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
    expect(publicPage).not.toMatch(/SHARED_LIST_EMPTY/);
    expect(SHARED_LIST_NOT_FOUND).toBe('Not found.');
    expect(SHARED_LIST_EMPTY).toBe('Nothing to show yet.');
    expect(publicPage).toMatch(/fetchPublicProfile/);
    expect(publicPage).not.toMatch(/from\('events'\)|from\('concerts'\)|from\('profiles'\)|from\('attendance'\)/);
    expect(publicPage).not.toMatch(/Add concert|label="Add"/);
    expect(publicPage).toMatch(/Shared list for \{\{ profile\.username \}\}/);
    expect(publicPage).toMatch(/shared-list-load-error/);

    const publicStore = read('app/stores/shared-list.ts');
    expect(publicStore).toMatch(/getSharedListProfile/);
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
