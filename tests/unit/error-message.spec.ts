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

  it('prefers Nitro statusMessage over ofetch status lines', () => {
    const error = Object.assign(new Error('[POST] "/api/agent/connection": 500'), {
      data: {
        statusCode: 500,
        statusMessage: 'Agent credential encryption is not configured.',
        message: 'Agent credential encryption is not configured.'
      },
      statusMessage: 'Agent credential encryption is not configured.'
    });
    expect(getErrorMessage(error, 'Failed to connect Cursor.')).toBe(
      'Agent credential encryption is not configured.'
    );
  });

  it('returns the fallback for a bare ofetch status line', () => {
    expect(getErrorMessage(new Error('[POST] "/api/agent/connection": 500'), 'Failed to connect Cursor.'))
      .toBe('Failed to connect Cursor.');
  });
});
