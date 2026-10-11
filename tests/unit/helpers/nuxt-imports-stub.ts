export const useSupabaseClient = () => ({
  auth: {
    getSession: async () => ({
      data: { session: { access_token: 'token' } }
    })
  }
});

export const useToast = () => ({
  add: () => undefined
});

export const useRuntimeConfig = () => ({
  public: { supabase: { url: 'http://127.0.0.1:54321', key: 'anon' } },
  agentCapabilitySecret: 'secret',
  agentAllowedOrigin: '',
  agentCredentialEncryptionKey: '',
  supabaseServiceRoleKey: ''
});
