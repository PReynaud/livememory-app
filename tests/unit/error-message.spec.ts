import { describe, expect, it } from 'vitest';
import { getErrorMessage } from '../../app/utils/error-message';

describe('getErrorMessage', () => {
  it('returns the Error message', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('returns a string error as-is', () => {
    expect(getErrorMessage('nope', 'fallback')).toBe('nope');
  });

  it('returns the fallback for unknown values', () => {
    expect(getErrorMessage({ code: 1 }, 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
