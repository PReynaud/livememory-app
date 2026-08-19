export const COPY_LINK_FAILED = 'Couldn\'t copy the link.';

export const copyTextToClipboard = async (text: string): Promise<{ error: string | null }> => {
  try {
    await navigator.clipboard.writeText(text);
    return { error: null };
  } catch {
    return { error: COPY_LINK_FAILED };
  }
};
