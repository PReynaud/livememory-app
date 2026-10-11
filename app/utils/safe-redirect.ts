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

  const pathOnly = decoded.split(/[?#]/, 1)[0] ?? '';

  if (
    !decoded.startsWith('/')
    || decoded.startsWith('//')
    || decoded.includes('\\')
    || pathOnly.includes('://')
  ) {
    return fallback;
  }

  return decoded;
};
