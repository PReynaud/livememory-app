import { defineStore } from 'pinia';
import { computed } from 'vue';
import { navigateTo, useSupabaseClient, useSupabaseUser } from '#imports';
import { getErrorMessage } from '@/utils/error-message';
import {
  EMAIL_TAKEN_ERROR,
  isDuplicateEmailSignUp,
  mapSignInError,
  mapSignUpError
} from '@/utils/auth-errors';
import { isValidUsername, USERNAME_CHARSET_ERROR } from '@/utils/username';

export const useAuthStore = defineStore('auth', () => {
  const supabase = useSupabaseClient();
  const supabaseUser = useSupabaseUser();

  const user = computed(() => supabaseUser.value);
  const isAuthenticated = computed(() => Boolean(supabaseUser.value));

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      return { data, error: null };
    } catch (error: unknown) {
      return {
        data: null,
        error: mapSignInError(error)
      };
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    if (!isValidUsername(username)) {
      return {
        data: null,
        error: USERNAME_CHARSET_ERROR
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          }
        }
      });

      if (error) {
        throw error;
      }

      if (isDuplicateEmailSignUp(data.user)) {
        return {
          data: null,
          error: EMAIL_TAKEN_ERROR
        };
      }

      if (!data.user) {
        return {
          data: null,
          error: 'An error occurred during sign up'
        };
      }

      return { data, error: null };
    } catch (error: unknown) {
      return {
        data: null,
        error: mapSignUpError(error)
      };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      await navigateTo('/login');
      return { error: null };
    } catch (error: unknown) {
      return {
        error: getErrorMessage(error, 'An error occurred during sign out')
      };
    }
  };

  return {
    user,
    isAuthenticated,
    signIn,
    signUp,
    signOut
  };
});
