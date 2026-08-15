# LiveMemory App

Personal concert attendance log. Users record shows, group them into events, and optionally share a read-only list.

Spawned from [nuxt-app-template](https://github.com/PReynaud/nuxt-app-template) by [software-factory](https://github.com/PReynaud/software-factory).

## Stack

- Nuxt 4, Nuxt UI 4, Pinia
- Supabase (SQL migrations + RLS + Auth)
- Playwright (local Supabase only) and Vitest
- BMAD Method, Cursor rules, MCP (Nuxt, Nuxt UI, Playwright, Supabase, Vercel)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:start
pnpm db:reset
pnpm db:types
pnpm dev
```

Add `http://localhost:3000/confirm` to the local Supabase Auth redirect URLs.

Production URL: https://livememory.pierre-reynaud.fr

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
