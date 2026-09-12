const FETCH_STATUS_LINE = /^\[[A-Z]+]\s+".*":\s+\d{3}\b/;
const GENERIC_HTTP_STATUS = /^(?:OK|Created|Accepted|Bad Request|Unauthorized|Forbidden|Not Found|Conflict|Internal Server Error)$/i;

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const readNestedMessage = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as { statusMessage?: unknown; message?: unknown; data?: unknown };
  return readString(record.statusMessage)
    || (readString(record.message) && !FETCH_STATUS_LINE.test(String(record.message))
      ? String(record.message).trim()
      : null)
    || readNestedMessage(record.data);
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  const nested = readNestedMessage(error);
  if (nested && !GENERIC_HTTP_STATUS.test(nested) && !FETCH_STATUS_LINE.test(nested)) {
    return nested;
  }

  if (error instanceof Error && error.message && !FETCH_STATUS_LINE.test(error.message)) {
    return error.message;
  }

  if (typeof error === 'string' && error.length > 0 && !FETCH_STATUS_LINE.test(error)) {
    return error;
  }

  return fallback;
};
