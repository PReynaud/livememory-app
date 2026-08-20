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
  const match = /^Bearer\s+(\S+)/i.exec(auth);
  return match?.[1]?.trim() ?? '';
};
