export const MCP_KEY_HEADER = 'x-livememory-key';

export const readPersonalKeyFromHeaders = (
  authorization: string | undefined,
  headerKey: string | undefined
): string => {
  const fromHeader = (headerKey ?? '').trim();
  if (fromHeader) {
    return fromHeader;
  }

  const auth = (authorization ?? '').trim();
  if (!auth) {
    return '';
  }

  const bearer = /^Bearer\s+(\S+)/i.exec(auth);
  if (bearer?.[1]) {
    return bearer[1].trim();
  }

  // Cursor Cloud MCP UI often stores the raw personal key as the Authorization value.
  if (auth.startsWith('lm_')) {
    return auth;
  }

  return '';
};
