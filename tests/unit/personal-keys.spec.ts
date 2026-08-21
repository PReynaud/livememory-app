import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createPersonalKey,
  generatePersonalKey,
  getPersonalKeyStatus,
  hashPersonalKey,
  PERSONAL_KEY_COLUMNS,
  revokePersonalKey,
  type PersonalKeyRecord,
  type PersonalKeysClient
} from '../../shared/domain/personal-keys';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

const readPersonalKeysMigration = () => {
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql') && name.includes('personal_keys'))
    .sort();

  expect(files.length).toBe(1);
  return readFileSync(resolve(migrationsDir, files[0]!), 'utf8');
};

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

type StoredRow = PersonalKeyRecord & { key_hash: string };

const createMemoryClient = (rows: StoredRow[] = []): PersonalKeysClient & { rows: StoredRow[] } => {
  const store = rows;
  const client: PersonalKeysClient & { rows: StoredRow[] } = {
    rows: store,
    from: (relation: 'personal_keys') => {
      expect(relation).toBe('personal_keys');
      return {
        select: (columns: string) => {
          expect(columns).toBe(PERSONAL_KEY_COLUMNS);
          expect(columns).not.toContain('key_hash');
          return {
            eq: (column: string, value: string) => ({
              maybeSingle: async () => {
                const row = store.find(entry => entry[column as 'user_id'] === value);
                if (!row) {
                  return { data: null, error: null };
                }

                return {
                  data: {
                    id: row.id,
                    user_id: row.user_id,
                    created_at: row.created_at
                  },
                  error: null
                };
              }
            })
          };
        },
        insert: (values: { user_id: string; key_hash: string }) => ({
          select: (columns: string) => {
            expect(columns).toBe(PERSONAL_KEY_COLUMNS);
            return {
              single: async () => {
                const record: StoredRow = {
                  id: `key-${store.length + 1}`,
                  user_id: values.user_id,
                  key_hash: values.key_hash,
                  created_at: '2026-08-20T00:00:00.000Z'
                };
                store.push(record);
                return {
                  data: {
                    id: record.id,
                    user_id: record.user_id,
                    created_at: record.created_at
                  },
                  error: null
                };
              }
            };
          }
        }),
        delete: () => ({
          eq: async (column: string, value: string) => {
            const remaining = store.filter(entry => entry[column as 'user_id'] !== value);
            store.splice(0, store.length, ...remaining);
            return { data: null, error: null };
          }
        })
      };
    }
  };

  return client;
};

describe('personal keys kernel', () => {
  it('stores a user-scoped hash, never plaintext or expiry, and looks up via SECURITY DEFINER', () => {
    const sql = readPersonalKeysMigration();

    expect(sql).toMatch(/create table public\.personal_keys/);
    expect(sql).toMatch(/id uuid primary key/);
    expect(sql).toMatch(/user_id uuid not null references public\.profiles/);
    expect(sql).toMatch(/key_hash text not null/);
    expect(sql).toMatch(/constraint personal_keys_user_id_key unique \(user_id\)/);
    expect(sql).toContain('key_hash ~ \'^[a-f0-9]{64}$\'');
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/\(select auth\.uid\(\)\) = user_id/);
    expect(sql).toMatch(/grant select, insert, delete on table public\.personal_keys to authenticated/);
    expect(sql).toMatch(/revoke all on table public\.personal_keys from public, anon, authenticated, service_role/);
    expect(sql).toMatch(/create or replace function public\.lookup_personal_key_user\(key_hash text\)/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/revoke execute on function public\.lookup_personal_key_user\(text\) from anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.lookup_personal_key_user\(text\) to service_role/);
    expect(sql).not.toMatch(/plaintext/);
    expect(sql).not.toMatch(/expires/);
    expect(sql).not.toMatch(/from\('events'\)/);
    expect(sql).not.toMatch(/grant select on table public\.personal_keys to service_role/);
    expect(sql).not.toMatch(/grant select, insert, update, delete on table public\.personal_keys to service_role/);
  });
});

describe('personal key domain', () => {
  it('hashes plaintext with SHA-256 and persists only the hash', async () => {
    const client = createMemoryClient();
    const created = await createPersonalKey(client, 'user-1');

    expect(created.error).toBeNull();
    expect(created.data?.plaintext.startsWith('lm_')).toBe(true);
    expect(created.data?.record).toEqual({
      id: 'key-1',
      user_id: 'user-1',
      created_at: '2026-08-20T00:00:00.000Z'
    });
    expect(client.rows).toHaveLength(1);
    expect(client.rows[0]?.key_hash).toBe(sha256Hex(created.data!.plaintext));
    expect(client.rows[0]?.key_hash).toBe(await hashPersonalKey(created.data!.plaintext));
    expect(JSON.stringify(client.rows)).not.toContain(created.data!.plaintext);
  });

  it('replaces the previous key and revoke removes the hash so exchange cannot succeed', async () => {
    const client = createMemoryClient();
    const first = await createPersonalKey(client, 'user-1');
    const second = await createPersonalKey(client, 'user-1');

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(client.rows).toHaveLength(1);
    expect(client.rows[0]?.key_hash).toBe(sha256Hex(second.data!.plaintext));
    expect(client.rows[0]?.key_hash).not.toBe(sha256Hex(first.data!.plaintext));

    const status = await getPersonalKeyStatus(client, 'user-1');
    expect(status.data?.id).toBe(second.data?.record.id);

    const revoked = await revokePersonalKey(client, 'user-1');
    expect(revoked.error).toBeNull();
    expect(client.rows).toHaveLength(0);

    const empty = await getPersonalKeyStatus(client, 'user-1');
    expect(empty.data).toBeNull();
  });

  it('generates high-entropy secrets', () => {
    const left = generatePersonalKey();
    const right = generatePersonalKey();
    expect(left).not.toBe(right);
    expect(left.startsWith('lm_')).toBe(true);
    expect(left.length).toBeGreaterThan(40);
  });
});

describe('personal key surfaces', () => {
  it('Profile creates, copies once, and revokes through the store and domain', () => {
    const store = read('app/stores/personal-keys.ts');
    expect(store).toMatch(/useSupabaseClient/);
    expect(store).toMatch(/createPersonalKey/);
    expect(store).toMatch(/revokePersonalKey/);
    expect(store).toMatch(/getPersonalKeyStatus/);
    expect(store).toMatch(/plaintext/);
    expect(store).toMatch(/finally/);
    expect(store).not.toMatch(/from\('personal_keys'\)/);
    expect(store).not.toMatch(/service_role/);

    const page = read('app/pages/profile.vue');
    expect(page).toMatch(/usePersonalKeysStore/);
    expect(page).toMatch(/PERSONAL_KEY_HELPER/);
    expect(page).toMatch(/PERSONAL_KEY_COPY_NOW/);
    expect(page).toMatch(/PERSONAL_KEY_ACTIVE/);
    expect(page).toMatch(/COPY_KEY_FAILED/);
    expect(page).toMatch(/Create personal key/);
    expect(page).toMatch(/Copy key/);
    expect(page).toMatch(/Revoke key/);
    expect(page).toMatch(/personal-key-plaintext/);
    expect(page).toMatch(/dismissPlaintext/);
    expect(page).not.toMatch(/from\('personal_keys'\)/);
    expect(page).not.toMatch(/\$fetch/);
  });

  it('Nitro exchange verifies the hash, mints via Auth admin, and never touches domain tables with service_role', () => {
    const exchange = read('server/utils/personal-key-exchange.ts');
    const route = read('server/api/mcp/exchange.post.ts');
    const runtime = read('server/utils/mcp-runtime.ts');
    const config = read('nuxt.config.ts');

    expect(exchange).toMatch(/lookup_personal_key_user/);
    expect(exchange).toMatch(/hashPersonalKey/);
    expect(exchange).toMatch(/admin\/generate_link/);
    expect(exchange).toMatch(/auth\/v1\/verify/);
    expect(exchange).toMatch(/profiles\?id=eq/);
    expect(exchange).toMatch(/Authorization: `Bearer \$\{accessToken\}`/);
    expect(exchange).toMatch(/SUPABASE_SERVICE_ROLE_KEY on the server/);
    expect(exchange).not.toMatch(/from\('events'\)/);
    expect(exchange).not.toMatch(/from\('concerts'\)/);
    expect(exchange).not.toMatch(/from\('attendance'\)/);
    expect(exchange).not.toMatch(/from\('event_members'\)/);
    expect(exchange).not.toMatch(/from\('event_stages'\)/);
    expect(exchange).not.toMatch(/\/rest\/v1\/events/);
    expect(exchange).not.toMatch(/\/rest\/v1\/concerts/);

    expect(route).toMatch(/exchangePersonalKey/);
    expect(route).toMatch(/readMcpSupabaseEnv/);
    expect(runtime).toMatch(/useRuntimeConfig/);
    expect(runtime).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);

    expect(config).toMatch(/supabaseServiceRoleKey/);
    expect(config).toMatch(/'\/': \{ prerender: true \}/);
    expect(config).not.toMatch(/public:[\s\S]*supabaseServiceRoleKey/);
  });
});
