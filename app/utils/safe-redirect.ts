export const getSafeInternalPath = (redirect: unknown, fallback = '/home'): string => {
  if (typeof redirect !== 'string') {
    return fallback;
  }

  let decoded: string;

  try {
    decoded = decodeURIComponent(redirect);
  } catch {
    return fallback;
  }

  if (
    !decoded.startsWith('/')
    || decoded.startsWith('//')
    || decoded.includes('\\')
    || decoded.includes('://')
  ) {
    return fallback;
  }

  return decoded;
};
