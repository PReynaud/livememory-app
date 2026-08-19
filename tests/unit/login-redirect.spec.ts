import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLoginRedirect } from '../../app/utils/login-redirect';

const login = (query: Record<string, unknown> = {}, fullPath = '/login') => ({
  path: '/login' as const,
  fullPath,
  query
});

describe('nextLoginRedirect', () => {
  it('preserves safe in-app origins such as Event and Concerts paths', () => {
    expect(nextLoginRedirect(login(), { fullPath: '/e/11111111-1111-4111-8111-111111111111' })).toEqual({
      path: '/login',
      query: { redirect: '/e/11111111-1111-4111-8111-111111111111' }
    });
    expect(nextLoginRedirect(login(), { fullPath: '/concerts' })).toEqual({
      path: '/login',
      query: { redirect: '/concerts' }
    });
    expect(nextLoginRedirect(login(), { fullPath: '/home' })).toEqual({
      path: '/login',
      query: { redirect: '/home' }
    });
  });

  it('skips unsafe fallbacks instead of rewriting them to /home', () => {
    expect(nextLoginRedirect(login(), { fullPath: '//evil.example' })).toBeNull();
    expect(nextLoginRedirect(login(), { fullPath: 'https://evil.example' })).toBeNull();
    expect(nextLoginRedirect(login(), { fullPath: '/%2F%2Fevil.example' })).toBeNull();
  });

  it('leaves an existing redirect query untouched', () => {
    expect(nextLoginRedirect(login({ redirect: '/concerts' }), { fullPath: '/e/abc' })).toBeNull();
    expect(nextLoginRedirect(login({ redirect: ['/concerts'] }), { fullPath: '/e/abc' })).toBeNull();
  });

  it('does not loop on login itself or empty origins', () => {
    expect(nextLoginRedirect(login(), { fullPath: '/login' })).toBeNull();
    expect(nextLoginRedirect(login({}, '/login?redirect=/concerts'), { fullPath: '/login?redirect=/concerts' })).toBeNull();
    expect(nextLoginRedirect(login(), { fullPath: '/login?foo=1' })).toBeNull();
    expect(nextLoginRedirect(login(), { fullPath: undefined })).toBeNull();
    expect(nextLoginRedirect({ path: '/concerts', fullPath: '/concerts', query: {} }, { fullPath: '/home' })).toBeNull();
  });
});

describe('login redirect middleware', () => {
  it('delegates preservation to nextLoginRedirect', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/middleware/login-redirect.global.ts'), 'utf8');
    expect(source).toContain('nextLoginRedirect');
    expect(source).toContain('navigateTo');
  });
});
