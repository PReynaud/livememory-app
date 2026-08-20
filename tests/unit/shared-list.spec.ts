import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COPY_LINK_FAILED } from '../../app/utils/copy-link';
import { getSharedListProfile, SHARED_LIST_EMPTY, SHARED_LIST_HELPER, SHARED_LIST_NOT_FOUND } from '../../shared/domain/shared-list';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

const readSharingMigration = () => {
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql') && name.includes('shared_list_enable'))
    .sort();

  expect(files.length).toBe(1);
  return readFileSync(resolve(migrationsDir, files[0]!), 'utf8');
};

describe('shared list kernel', () => {
  it('persists sharing off by default and exposes only enabled usernames publicly', () => {
    const sql = readSharingMigration();

    expect(sql).toMatch(/add column shared_list_enabled boolean not null default false/);
    expect(sql).toMatch(/create view public\.shared_list_profiles/);
    expect(sql).toMatch(/security_invoker = false/);
    expect(sql).toMatch(/where profiles\.shared_list_enabled/);
    expect(sql).toMatch(/lower\(profiles\.username\) as username_key/);
    expect(sql).toMatch(/grant select on table public\.shared_list_profiles to anon, authenticated/);
    expect(sql).toMatch(/revoke all on table public\.profiles from anon/);
    expect(sql).toMatch(/grant update \(shared_list_enabled\) on table public\.profiles to authenticated/);
    expect(sql).not.toMatch(/service_role/);
  });
});

describe('getSharedListProfile', () => {
  it('returns the enabled username and treats missing rows as quiet not-found', async () => {
    const found = await getSharedListProfile({
      from: () => ({
        select: () => ({
          eq: (column: string, value: string) => {
            expect(column).toBe('username_key');
            expect(value).toBe('pierre');
            return {
              maybeSingle: async () => ({ data: { username: 'Pierre' }, error: null })
            };
          }
        })
      })
    }, 'Pierre');

    expect(found.error).toBeNull();
    expect(found.data).toEqual({ username: 'Pierre' });

    const missing = await getSharedListProfile({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null })
          })
        })
      })
    }, 'ghost');

    expect(missing.error).toBeNull();
    expect(missing.data).toBeNull();
  });

  it('matches username case-insensitively without treating underscore as a wildcard', async () => {
    let lookup = '';
    const result = await getSharedListProfile({
      from: () => ({
        select: () => ({
          eq: (column: string, value: string) => {
            lookup = `${column}:${value}`;
            return {
              maybeSingle: async () => ({ data: { username: 'a_b' }, error: null })
            };
          }
        })
      })
    }, 'A_B');

    expect(lookup).toBe('username_key:a_b');
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
    expect(profilePage).toMatch(/COPY_LINK_FAILED/);
    expect(COPY_LINK_FAILED).toBe('Couldn\'t copy the link.');
    expect(profilePage).toContain(SHARED_LIST_HELPER);
    expect(profilePage).not.toMatch(/from\('profiles'\)/);
    expect(profilePage).not.toMatch(/directory|User search|find users/i);

    const store = read('app/stores/profile.ts');
    expect(store).toMatch(/shared_list_enabled/);
    expect(store).toMatch(/setSharedListEnabled/);
    expect(store).toMatch(/auth\.getUser/);
    expect(store).toMatch(/finally/);

    const publicPage = read('app/pages/u/[username].vue');
    expect(publicPage).toContain(SHARED_LIST_EMPTY);
    expect(publicPage).toContain(SHARED_LIST_NOT_FOUND);
    expect(publicPage).toMatch(/fetchPublicProfile/);
    expect(publicPage).not.toMatch(/from\('events'\)|from\('concerts'\)|from\('profiles'\)|from\('attendance'\)/);
    expect(publicPage).not.toMatch(/Add concert|label="Add"/);
    expect(publicPage).toMatch(/Shared list for \{\{ profile\.username \}\}/);
    expect(publicPage).toMatch(/shared-list-load-error/);

    const publicStore = read('app/stores/shared-list.ts');
    expect(publicStore).toMatch(/getSharedListProfile/);
    expect(publicStore).toMatch(/shared_list_profiles|getSharedListProfile/);
  });
});
