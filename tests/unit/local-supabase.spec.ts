import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertLocalSupabaseUrl, LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from '../e2e/local-supabase';

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
