import { defineNuxtRouteMiddleware, navigateTo, useSupabaseClient, useSupabaseUser } from '#imports';

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser();

  if (user.value) {
    return;
  }

  const supabase = useSupabaseClient();
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    return navigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    });
  }
});
