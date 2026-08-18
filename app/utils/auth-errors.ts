import { getErrorMessage } from '@/utils/error-message';

export const USERNAME_TAKEN_ERROR = 'This username is taken';
export const EMAIL_TAKEN_ERROR = 'This email already has an account.';
export const WRONG_CREDENTIALS_ERROR = 'Email or password is wrong.';

const getErrorCode = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }

  return '';
};

export const mapSignInError = (error: unknown): string => {
  const message = getErrorMessage(error, '');
  const code = getErrorCode(error);

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return WRONG_CREDENTIALS_ERROR;
  }

  return getErrorMessage(error, 'An error occurred during sign in');
};

export const mapSignUpError = (error: unknown): string => {
  const message = getErrorMessage(error, '');
  const code = getErrorCode(error);

  if (
    /profiles_username_lower_idx/i.test(message)
    || /database error saving new user/i.test(message)
  ) {
    return USERNAME_TAKEN_ERROR;
  }

  if (
    code === 'user_already_exists'
    || /already registered/i.test(message)
    || /already been registered/i.test(message)
    || /already has an account/i.test(message)
  ) {
    return EMAIL_TAKEN_ERROR;
  }

  return getErrorMessage(error, 'An error occurred during sign up');
};

export const isDuplicateEmailSignUp = (user: { identities?: unknown[] | null } | null): boolean => {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0);
};
