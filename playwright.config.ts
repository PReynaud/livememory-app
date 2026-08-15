import { defineConfig, devices } from '@playwright/test';
import {
  assertLocalSupabaseUrl,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL
} from './tests/e2e/local-supabase';

const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL;
assertLocalSupabaseUrl(supabaseUrl);

const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || LOCAL_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || LOCAL_SUPABASE_SERVICE_ROLE_KEY;

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      NUXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NUXT_PUBLIC_SUPABASE_KEY: supabaseKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      NUXT_DEVTOOLS: '0'
    }
  }
});
