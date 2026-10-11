const REDIRECT_URI_MAX = 2048;

// Keep this aligned with public.oauth_redirect_uri_allowed. A URI that function
// rejects must be rejected here too, or registration reaches SQL and returns 500.
const HTTPS_REDIRECT = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?(\/[^\s#]*)?$/;
const LOOPBACK_REDIRECT = /^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?(\/[^\s#]*)?$/;

export const isAllowedRedirectUri = (value: string) => {
  if (!value || value.length > REDIRECT_URI_MAX) {
    return false;
  }

  if (!HTTPS_REDIRECT.test(value) && !LOOPBACK_REDIRECT.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
};
