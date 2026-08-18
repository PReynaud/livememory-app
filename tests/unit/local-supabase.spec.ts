import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertLocalSupabaseUrl, LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from '../e2e/local-supabase';
import { generateE2EAccountData } from '../e2e/helpers/e2e-account';

describe('assertLocalSupabaseUrl', () => {
  it('allows loopback hosts', () => {
    expect(() => assertLocalSupabaseUrl('http://127.0.0.1:54321')).not.toThrow();
    expect(() => assertLocalSupabaseUrl('http://localhost:54321')).not.toThrow();
  });

  it('rejects remote hosts', () => {
    expect(() => assertLocalSupabaseUrl('https://example.supabase.co')).toThrow(/local Supabase/);
  });
});

describe('ci workflow', () => {
  it('supplies local Supabase public env for the Vercel prerender', () => {
    const source = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

    expect(source).toContain(`NUXT_PUBLIC_SUPABASE_URL: ${LOCAL_SUPABASE_URL}`);
    expect(source).toContain(LOCAL_SUPABASE_ANON_KEY);
  });
});

describe('e2e auth fixture', () => {
  it('imports helpers from the sibling e2e helpers folder', () => {
    const source = readFileSync(resolve(process.cwd(), 'tests/e2e/fixtures/auth.fixture.ts'), 'utf8');

    expect(source).toContain('from \'../helpers/e2e-account\'');
    expect(source).toContain('from \'../helpers/wait-for-hydration\'');
  });

  it('resolves local supabase helpers from the e2e root', () => {
    const source = readFileSync(resolve(process.cwd(), 'tests/e2e/helpers/e2e-account.ts'), 'utf8');

    expect(source).toContain('from \'../local-supabase\'');
    expect(source).toContain('user_metadata');
    expect(source).toMatch(/username:\s*accountUsername/);
  });

  it('generates a charset-valid username with the email and password', () => {
    const account = generateE2EAccountData('Unit User');
    expect(account.username).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(account.email).toContain('@example.com');
  });
});
