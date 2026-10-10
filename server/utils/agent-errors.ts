/**
 * Detect Cursor SDK errors without relying on `instanceof`.
 * Nitro may load `@cursor/sdk` via CJS while app code imports ESM, so
 * cross-realm AuthenticationError instances fail `instanceof CursorAgentError`
 * and would otherwise leak raw messages like "Authentication is required."
 */
const CURSOR_AGENT_ERROR_NAME
  = /^(CursorAgentError|AuthenticationError|RateLimitError|ConfigurationError|NetworkError|AgentBusyError|AgentNotFoundError|UnknownAgentError)$/;

export const isCursorAgentError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  return CURSOR_AGENT_ERROR_NAME.test(String((error as { name?: unknown }).name || ''));
};

export const cursorAgentUserMessage = (_error?: unknown): string =>
  'Your Cursor connection needs to be reconnected.';
