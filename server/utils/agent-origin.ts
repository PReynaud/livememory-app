export const trustedAgentOrigins = (requestOrigin: string, configuredOrigin: string) =>
  new Set([requestOrigin, configuredOrigin].filter(Boolean));

/** Prefer a configured public origin for Cursor cloud MCP callbacks; skip localhost placeholders. */
export const resolveAgentMcpOrigin = (requestOrigin: string, configuredOrigin: string) => {
  const configured = configuredOrigin.trim();
  if (!configured) return requestOrigin;
  try {
    const { hostname } = new URL(configured);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return requestOrigin;
  } catch {
    return requestOrigin;
  }
  return configured.replace(/\/$/, '');
};
