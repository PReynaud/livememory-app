import { COPY_LINK_FAILED, copyTextToClipboard } from '@/utils/copy-link';

export const LINK_COPIED = 'Link copied.';

export type ShareEventPayload = {
  title: string;
  text: string;
  url: string;
};

export type ShareEventResult = {
  method: 'share' | 'clipboard';
  error: string | null;
};

export const shareEventLink = async (payload: ShareEventPayload): Promise<ShareEventResult> => {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(payload);
      return { method: 'share', error: null };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { method: 'share', error: null };
      }
    }
  }

  const copied = await copyTextToClipboard(payload.url);
  return {
    method: 'clipboard',
    error: copied.error ? COPY_LINK_FAILED : null
  };
};
