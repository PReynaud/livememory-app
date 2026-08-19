import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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

const lastHandleNewUserBody = (sql: string) => {
  const matches = [...sql.matchAll(/create or replace function public\.handle_new_user\(\)([\s\S]*?)\$\$;/gi)];
  const last = matches.at(-1);
  expect(last).toBeTruthy();
  return last?.[0] ?? '';
};

describe('profiles username kernel', () => {
  it('enforces unique lower(username) and charset on the follow-on migration', () => {
    const migrations = readMigrations();
    const usernameMigration = migrations.find(file => file.name.includes('profiles_username'));

    expect(usernameMigration).toBeTruthy();
    const sql = usernameMigration?.sql ?? '';

    expect(sql).toMatch(/unique index[\s\S]*lower\s*\(\s*username\s*\)/i);
    expect(sql).toContain('username ~ \'^[A-Za-z0-9_-]+$\'');
    expect(sql).toMatch(/username[\s\S]*not null/i);
    expect(sql).toMatch(/drop column display_name/i);
    expect(sql).toContain('\'u\' || replace(id::text, \'-\', \'\')');
    expect(sql).toMatch(/username_is_taken/);
  });

  it('rewrites handle_new_user to read username metadata without an email fallback', () => {
    const sql = readMigrations().map(file => file.sql).join('\n');
    const body = lastHandleNewUserBody(sql);

    expect(body).toMatch(/raw_user_meta_data\s*->>\s*'username'/);
    expect(body).toMatch(/Username is required/);
    expect(body).not.toMatch(/display_name/);
    expect(body).not.toMatch(/split_part/);
  });

  it('keeps EXECUTE revoked on handle_new_user after the rewrite', () => {
    const sql = readMigrations().map(file => file.sql).join('\n');
    const revokeMatches = [...sql.matchAll(/revoke execute on function public\.handle_new_user\(\)/gi)];

    expect(revokeMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks username updates in the database', () => {
    const sql = readMigrations().map(file => file.sql).join('\n');

    expect(sql).toMatch(/prevent_username_update/);
    expect(sql).toMatch(/Username cannot be changed/);
    expect(sql).toMatch(/revoke execute on function public\.prevent_username_update\(\)/i);
  });
});

describe('profile store', () => {
  it('loads own username through a user-scoped client and does not leave pages querying profiles', () => {
    const store = readFileSync(resolve(process.cwd(), 'app/stores/profile.ts'), 'utf8');
    expect(store).toMatch(/useSupabaseClient/);
    expect(store).toMatch(/from\('profiles'\)/);
    expect(store).toMatch(/username/);
    expect(store).toMatch(/\{ data, error \}|return \{[\s\S]*data:[\s\S]*error:/);

    const pages = ['home', 'concerts', 'profile', 'login'].map((name) => {
      return readFileSync(resolve(process.cwd(), `app/pages/${name}.vue`), 'utf8');
    });

    for (const source of pages) {
      expect(source).not.toMatch(/from\('profiles'\)/);
    }

    const profilePage = readFileSync(resolve(process.cwd(), 'app/pages/profile.vue'), 'utf8');
    expect(profilePage).toMatch(/storeToRefs\(profileStore\)/);
    expect(profilePage).toContain('profile-error');
    expect(profilePage).toMatch(/v-if="error"/);
  });
});
