import { defineNuxtRouteMiddleware, navigateTo } from '#imports';
import { nextLoginRedirect } from '@/utils/login-redirect';

export default defineNuxtRouteMiddleware((to, from) => {
  const next = nextLoginRedirect(
    {
      path: to.path,
      fullPath: to.fullPath,
      query: to.query
    },
    { fullPath: from.fullPath }
  );

  if (!next) {
    return;
  }

  return navigateTo(next);
});
