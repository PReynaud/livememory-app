import { describe, expect, it } from 'vitest';
import { getSafeInternalPath } from '../../app/utils/safe-redirect';

describe('getSafeInternalPath', () => {
  it('allows in-app paths and rejects protocol-relative or encoded external URLs', () => {
    expect(getSafeInternalPath('/home')).toBe('/home');
    expect(getSafeInternalPath('/e/abc')).toBe('/e/abc');
    expect(getSafeInternalPath('//evil.example')).toBe('/home');
    expect(getSafeInternalPath('/%2F%2Fevil.example')).toBe('/home');
    expect(getSafeInternalPath('https://evil.example')).toBe('/home');
  });
});
