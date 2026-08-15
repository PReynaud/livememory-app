import { defineNuxtRouteMiddleware, navigateTo, useSupabaseUser } from '#imports';

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();

  if (!user.value) {
    return navigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    });
  }
});
