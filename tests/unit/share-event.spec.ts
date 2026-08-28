import { afterEach, describe, expect, it, vi } from 'vitest';
import { COPY_LINK_FAILED } from '../../app/utils/copy-link';
import { LINK_COPIED, shareEventLink } from '../../app/utils/share-event';

const payload = {
  title: 'Rock Week',
  text: 'Rock Week — Paris',
  url: 'https://example.test/e/1'
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shareEventLink', () => {
  it('uses the Web Share API when it succeeds', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });

    await expect(shareEventLink(payload)).resolves.toEqual({ method: 'share', error: null });
    expect(share).toHaveBeenCalledWith(payload);
  });

  it('treats AbortError as a cancelled share, not a failure', async () => {
    const abort = new Error('cancelled');
    abort.name = 'AbortError';
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(abort) });

    await expect(shareEventLink(payload)).resolves.toEqual({ method: 'share', error: null });
  });

  it('falls back to clipboard when share is missing', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    });

    await expect(shareEventLink(payload)).resolves.toEqual({ method: 'clipboard', error: null });
  });

  it('falls back to clipboard when share fails for another reason', async () => {
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(new Error('no share')),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    });

    await expect(shareEventLink(payload)).resolves.toEqual({ method: 'clipboard', error: null });
  });

  it('returns COPY_LINK_FAILED when clipboard fallback fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
    });

    await expect(shareEventLink(payload)).resolves.toEqual({
      method: 'clipboard',
      error: COPY_LINK_FAILED
    });
  });

  it('exports the clipboard toast copy', () => {
    expect(LINK_COPIED).toBe('Link copied.');
  });
});
