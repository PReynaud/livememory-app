import { describe, expect, it } from 'vitest';
import { assertLocalSupabaseUrl } from '../e2e/local-supabase';

describe('assertLocalSupabaseUrl', () => {
  it('allows loopback hosts', () => {
    expect(() => assertLocalSupabaseUrl('http://127.0.0.1:54321')).not.toThrow();
    expect(() => assertLocalSupabaseUrl('http://localhost:54321')).not.toThrow();
  });

  it('rejects remote hosts', () => {
    expect(() => assertLocalSupabaseUrl('https://example.supabase.co')).toThrow(/local Supabase/);
  });
});
