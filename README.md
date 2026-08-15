# Nuxt app template

GitHub Template used by [software-factory](https://github.com/PReynaud/software-factory) to spawn new Nuxt 4 apps.

## Stack

- Nuxt 4, Nuxt UI 4, Pinia
- Supabase (SQL migrations + RLS + Auth)
- Playwright (local Supabase only) and Vitest
- BMAD Method, Cursor rules, MCP (Nuxt, Nuxt UI, Playwright, Supabase, Vercel)
- PWA via `@vite-pwa/nuxt` (remove with `factory-new-app --no-pwa`)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:start
pnpm db:reset
pnpm db:types
pnpm pwa:icons
pnpm dev
```

Add `http://localhost:3000/confirm` to the local Supabase Auth redirect URLs.

## Tests

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:e2e
```

Playwright refuses non-local Supabase URLs. Create accounts per test; they are deleted afterwards.

## Language

Conversation may be English or French. All produced artifacts are English.

## Create a new app

Use the `factory-new-app` skill in `software-factory`. Do not copy this repo by hand if you need DNS, Vercel, and a Supabase project.
