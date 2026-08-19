import type { LocationQueryRaw } from 'vue-router';
import { getSafeInternalPath } from '@/utils/safe-redirect';

export type LoginRedirectTo = {
  path: string;
  fullPath: string;
  query: object;
};

export type LoginRedirectFrom = {
  fullPath?: string;
};

const firstQueryValue = (value: unknown): unknown => {
  return Array.isArray(value) ? value[0] : value;
};

const asQuery = (query: object): LocationQueryRaw => {
  return query as LocationQueryRaw;
};

export const nextLoginRedirect = (
  to: LoginRedirectTo,
  from: LoginRedirectFrom
): { path: '/login'; query: LocationQueryRaw } | null => {
  if (to.path !== '/login') {
    return null;
  }

  const query = asQuery(to.query);
  const existing = firstQueryValue(query.redirect);
  if (typeof existing === 'string' && existing.length > 0) {
    return null;
  }

  const fromPath = from.fullPath;
  if (
    !fromPath
    || fromPath === to.fullPath
    || fromPath === '/login'
    || fromPath.startsWith('/login?')
  ) {
    return null;
  }

  const redirect = getSafeInternalPath(fromPath);
  if (redirect === '/home' && fromPath !== '/home' && !fromPath.startsWith('/home?')) {
    return null;
  }

  return {
    path: '/login',
    query: {
      ...query,
      redirect
    }
  };
};
