import { defineNuxtRouteMiddleware, navigateTo } from '#imports';
import { getSafeInternalPath } from '@/utils/safe-redirect';

export default defineNuxtRouteMiddleware((to, from) => {
  if (to.path !== '/login') {
    return;
  }

  const existing = Array.isArray(to.query.redirect) ? to.query.redirect[0] : to.query.redirect;
  if (typeof existing === 'string' && existing.length > 0) {
    return;
  }

  const fromPath = from.fullPath;
  if (
    !fromPath
    || fromPath === to.fullPath
    || fromPath === '/login'
    || fromPath.startsWith('/login?')
  ) {
    return;
  }

  const redirect = getSafeInternalPath(fromPath);
  if (redirect === '/home' && fromPath !== '/home' && !fromPath.startsWith('/home?')) {
    return;
  }

  return navigateTo({
    path: '/login',
    query: {
      ...to.query,
      redirect
    }
  });
});
