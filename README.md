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

## Production migrations

On push to `main` (paths under `supabase/migrations/**`), `.github/workflows/deploy-migrations.yml` runs `supabase db push --db-url`. Set the repo secret `SUPABASE_DB_URL` to the direct Postgres URI:

`postgresql://postgres:{password}@db.{project_ref}.supabase.co:5432/postgres`

(`factory-new-app` sets this during bootstrap. This app was spawned earlier: set the secret before the first deploy job.) Never commit the URI. Do not push `seed.sql` to production.

## Tests

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:e2e
```

A pre-commit hook runs `eslint --fix` on staged JS/TS/Vue files. Do not skip it with `--no-verify`.

Playwright refuses non-local Supabase URLs. Create accounts per test; they are deleted afterwards.

## Language

Conversation may be English or French. All produced artifacts are English.
