import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/test-utils',
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@vite-pwa/nuxt'
  ],

  imports: {
    autoImport: false
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      appName: 'App'
    }
  },

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        semi: true,
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'App',
      short_name: 'App',
      description: 'Nuxt app template with Supabase auth.',
      theme_color: '#0f766e',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      lang: 'en',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      cleanupOutdatedCaches: true,
      globPatterns: ['**/*.{js,css,html,png,svg,ico,txt,woff2}']
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      enabled: false,
      suppressWarnings: true,
      type: 'module'
    }
  },

  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/', '/login', '/confirm']
    }
  }
});
