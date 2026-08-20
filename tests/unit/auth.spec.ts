import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EMAIL_TAKEN_ERROR,
  isDatabaseErrorSavingNewUser,
  isDuplicateEmailSignUp,
  mapSignInError,
  mapSignUpError,
  USERNAME_TAKEN_ERROR,
  WRONG_CREDENTIALS_ERROR
} from '../../app/utils/auth-errors';
import { isValidUsername, USERNAME_CHARSET_ERROR } from '../../app/utils/username';

const createAuthError = (
  message: string,
  code?: string,
  extra?: { details?: string; hint?: string }
) => {
  const error = new Error(message) as Error & { code?: string; details?: string; hint?: string };
  if (code) {
    error.code = code;
  }
  if (extra?.details) {
    error.details = extra.details;
  }
  if (extra?.hint) {
    error.hint = extra.hint;
  }
  return error;
};

describe('useAuthStore contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/stores/auth.ts'), 'utf8');

  it('sends username in signUp user metadata', () => {
    expect(source).toMatch(/signUp = async \(email: string, password: string, username: string\)/);
    expect(source).toMatch(/isValidUsername/);
    expect(source).toMatch(/options:\s*\{[\s\S]*data:\s*\{[\s\S]*username/);
  });

  it('maps a unique username collision to the SPEC copy', () => {
    expect(mapSignUpError(createAuthError(
      'duplicate key value violates unique constraint "profiles_username_lower_idx"',
      '23505'
    ))).toBe(USERNAME_TAKEN_ERROR);
    expect(mapSignUpError(createAuthError(
      'Database error saving new user',
      'unexpected_failure',
      { details: 'duplicate key value violates unique constraint "profiles_username_lower_idx"' }
    ))).toBe(USERNAME_TAKEN_ERROR);
    expect(mapSignUpError(createAuthError('duplicate key value violates unique constraint "other_idx"', '23505'))).not.toBe(USERNAME_TAKEN_ERROR);
    expect(mapSignUpError(createAuthError('Database error saving new user', 'unexpected_failure'))).not.toBe(USERNAME_TAKEN_ERROR);
    expect(isDatabaseErrorSavingNewUser(createAuthError('Database error saving new user'))).toBe(true);
    expect(source).toContain('mapSignUpError');
    expect(source).toContain('username_is_taken');
    expect(source).toContain('isDatabaseErrorSavingNewUser');
  });

  it('maps a duplicate email to the SPEC copy', () => {
    expect(isDuplicateEmailSignUp({ identities: [] })).toBe(true);
    expect(mapSignUpError(createAuthError('User already registered', 'user_already_exists'))).toBe(EMAIL_TAKEN_ERROR);
    expect(source).toContain('EMAIL_TAKEN_ERROR');
  });

  it('maps wrong credentials to the SPEC copy', () => {
    expect(mapSignInError(createAuthError('Invalid login credentials', 'invalid_credentials'))).toBe(WRONG_CREDENTIALS_ERROR);
    expect(source).toContain('mapSignInError');
  });

  it('lets auth middleware wait for a session before bouncing to login', () => {
    const middleware = readFileSync(resolve(process.cwd(), 'app/middleware/auth.ts'), 'utf8');
    expect(middleware).toContain('getSession');
    expect(middleware).toMatch(/if \(user\.value\)/);
  });

  it('sends an explicit sign-out to login with Home as the next landing', () => {
    expect(source).toMatch(/navigateTo\(\{\s*path: '\/login',\s*query: \{\s*redirect: '\/home'\s*\}\s*\}\)/);
  });
});

describe('login form I/O', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pages/login.vue'), 'utf8');

  it('collects username on register and ignores a second submit while busy', () => {
    expect(source).toMatch(/v-model="username"/);
    expect(source).toMatch(/if \(loading\.value\) return/);
    expect(source).toMatch(/:loading="loading"/);
  });

  it('rejects invalid username charset before calling signUp', () => {
    expect(isValidUsername('Ada_1-ok')).toBe(true);
    expect(isValidUsername('has space')).toBe(false);
    expect(isValidUsername('bad!')).toBe(false);
    expect(isValidUsername('')).toBe(false);
    expect(USERNAME_CHARSET_ERROR).toBe('Username can only contain letters, digits, underscores, and hyphens.');
    expect(source).toContain('isValidUsername');
    expect(source).toContain('USERNAME_CHARSET_ERROR');
  });
});

describe('guest header', () => {
  it('sends a signed-in visitor to Home instead of Sign in', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/components/AppHeader.vue'), 'utf8');

    expect(source).toContain('useSupabaseUser');
    expect(source).toContain('isAuthenticated');
    expect(source).toContain('label="Home"');
    expect(source).toContain('label="Sign in"');
  });
});
