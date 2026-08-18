export const USERNAME_CHARSET_PATTERN = /^[A-Za-z0-9_-]+$/;
export const USERNAME_CHARSET_ERROR = 'Username can only contain letters, digits, underscores, and hyphens.';

export const isValidUsername = (username: string): boolean => USERNAME_CHARSET_PATTERN.test(username);
