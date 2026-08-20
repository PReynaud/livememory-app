import { assertLocalSupabaseUrl, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from '../local-supabase';

export interface E2EAccount {
  userId: string;
  email: string;
  password: string;
  username: string;
}

const toToken = (seed: string) => seed.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'e2euser';

export const generateE2EAccountData = (seed: string) => {
  const token = toToken(seed);
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    email: `e2e_${token}_${suffix}@example.com`,
    password: `Pw_${token}_${suffix}!`,
    username: `u_${token}_${suffix}`
  };
};

const adminHeaders = () => {
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || LOCAL_SUPABASE_SERVICE_ROLE_KEY;
  assertLocalSupabaseUrl(supabaseUrl);

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    serviceRoleKey
  };
};

export const createE2EAccountForTest = async (seed: string, username?: string): Promise<E2EAccount> => {
  const { supabaseUrl, serviceRoleKey } = adminHeaders();
  const generated = generateE2EAccountData(seed);
  const accountUsername = username ?? generated.username;

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: generated.email,
      password: generated.password,
      email_confirm: true,
      user_metadata: {
        username: accountUsername
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create E2E account: ${await response.text()}`);
  }

  const payload = await response.json() as { id: string; email?: string };

  return {
    userId: payload.id,
    email: payload.email || generated.email,
    password: generated.password,
    username: accountUsername
  };
};

export const deleteE2EAccountForTest = async (userId: string): Promise<void> => {
  const { supabaseUrl, serviceRoleKey } = adminHeaders();

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete E2E account: ${await response.text()}`);
  }
};

export const deleteE2EAccountByEmail = async (email: string): Promise<void> => {
  const { supabaseUrl, serviceRoleKey } = adminHeaders();

  for (let page = 1; page <= 5; page += 1) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list E2E accounts: ${await response.text()}`);
    }

    const payload = await response.json() as { users?: { id: string; email?: string }[] };
    const users = payload.users ?? [];
    const user = users.find(entry => entry.email === email);

    if (user) {
      await deleteE2EAccountForTest(user.id);
      return;
    }

    if (users.length < 200) {
      return;
    }
  }
};
