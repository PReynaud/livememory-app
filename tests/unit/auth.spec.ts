import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EMAIL_TAKEN_ERROR,
  isDuplicateEmailSignUp,
  mapSignInError,
  mapSignUpError,
  USERNAME_TAKEN_ERROR,
  WRONG_CREDENTIALS_ERROR
} from '../../app/utils/auth-errors';
import { isValidUsername, USERNAME_CHARSET_ERROR } from '../../app/utils/username';

const createAuthError = (message: string, code?: string) => {
  const error = new Error(message) as Error & { code?: string };
  if (code) {
    error.code = code;
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
    expect(mapSignUpError(createAuthError('duplicate key value violates unique constraint "other_idx"', '23505'))).not.toBe(USERNAME_TAKEN_ERROR);
    expect(source).toContain('mapSignUpError');
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
    expect(USERNAME_CHARSET_ERROR).toBe('Username can only contain letters, digits, underscores, and hyphens.');
    expect(source).toContain('isValidUsername');
    expect(source).toContain('USERNAME_CHARSET_ERROR');
  });
});
