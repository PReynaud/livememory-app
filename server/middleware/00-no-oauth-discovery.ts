import { defineEventHandler, getRequestURL, setResponseStatus } from 'h3';

/**
 * Cursor probes OAuth discovery before sending configured Authorization headers.
 * A 302 to /login (from @nuxtjs/supabase) is treated as OAuth metadata and the
 * personal-key header is never sent. Answer these probes with a hard 404.
 */
const isOauthDiscoveryPath = (pathname: string) => {
  const path = pathname.toLowerCase();
  return path.includes('/.well-known/oauth')
    || path.endsWith('/.well-known/openid-configuration')
    || path.includes('/.well-known/openid-configuration/');
};

export default defineEventHandler((event) => {
  const { pathname } = getRequestURL(event);
  if (!isOauthDiscoveryPath(pathname)) {
    return;
  }

  setResponseStatus(event, 404);
  return {
    error: 'Not found'
  };
});
