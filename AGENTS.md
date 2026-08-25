# AGENT.md — Coding guidelines

This document guides agents working in apps generated from `nuxt-app-template`.

## Language

- Chat with the user in **English or French**, matching the language they use.
- Produce **English only** for every artifact: code, comments, commits, PRs, README, BMAD documents, tests, file names, UI copy, and error messages.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Nuxt 4, Vue 3 Composition API |
| UI | Nuxt UI 4 (`UButton`, `UCard`, …) |
| State | Pinia setup stores |
| Database | PostgreSQL via Supabase (`supabase/migrations`, RLS) |
| Auth | Supabase Auth via `@nuxtjs/supabase` |
| Tests | Vitest (`tests/unit`) and Playwright (`tests/e2e`) |
| Package manager | pnpm |

## Design decisions

- Auto-imports are disabled. Import Vue, Nuxt, Pinia, and project modules explicitly — including `defineAppConfig` in `app/app.config.ts`.
- Pages and presentational components do not fetch remote data. Use Pinia stores.
- Schema lives in SQL migrations. Never add Prisma unless the product explicitly opts in.
- Playwright must target **local** Supabase only.

## Pinia store pattern

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getErrorMessage } from '@/utils/error-message'

export const useMyStore = defineStore('myStore', () => {
  const items = ref<Item[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const hasItems = computed(() => items.value.length > 0)

  const fetchItems = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<Item[]>('/api/items')
      items.value = response
      return { data: response, error: null }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to fetch items')
      error.value = errorMessage
      return { data: null, error: errorMessage }
    } finally {
      loading.value = false
    }
  }

  return {
    items,
    loading,
    error,
    hasItems,
    fetchItems
  }
})
```

## Tests

- Every story must add or update tests (`tests/unit` and/or `tests/e2e`).
- Prefer red-green-refactor for `bmad-dev-story` and `bmad-quick-dev`.
- E2E accounts are created per test against local Supabase and deleted afterwards.
- Pre-commit runs `eslint --fix` on staged JS/TS/Vue via lint-staged. Do not skip hooks (`--no-verify`).

## Product delivery

Plan and implement features through **BMAD Method** workflows (spec → PRD/architecture/stories → `bmad-dev-story`), not ad-hoc dumps.

## Known pitfalls

- Import `defineAppConfig` from `#imports` in `app/app.config.ts`. Auto-imports are off; omitting it fails `pnpm build:vercel` prerender with `defineAppConfig is not defined` while lint and unit tests still pass.
- GitHub Actions has no `.env`. The CI Vercel build must set `NUXT_PUBLIC_SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_KEY` (local demo values) or prerender of `/` fails with `Cannot read properties of undefined (reading 'state')`.
- Commit `app/types/database.types.ts` from `pnpm db:types` after schema changes. CI regenerates that file and fails on any diff.
- Hosted schema is pushed by `.github/workflows/deploy-migrations.yml` on `main` (`supabase link` then `supabase db push`). Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (plain database password, not a URI), and variable `SUPABASE_PROJECT_ID`. Direct `db.{ref}.supabase.co:5432` is IPv6-only and fails on GitHub-hosted runners. CI `supabase db reset` only refreshes the GitHub Actions local database.
- Production MCP (`/api/mcp`) needs `SUPABASE_SERVICE_ROLE_KEY` on Vercel (server-only). Without it, authenticated MCP calls return `500 Personal key exchange is not configured` and Cursor tool discovery fails even with a valid personal key.
- Cursor probes `/.well-known/oauth-*` before sending static `Authorization` headers. Those paths must return **404** (not a Supabase auth redirect to `/login`), or Cursor ignores the personal key and MCP tool discovery fails.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm lint:fix
pnpm typecheck
pnpm test:unit
pnpm test:e2e
pnpm build
```

## Cursor Cloud specific instructions

Standard commands live in `## Commands` above, `README.md`, and `package.json` scripts. The update script only runs `pnpm install` (its `postinstall` runs `nuxt prepare`) and ensures `.env` exists. Anything below must be started manually per session; do not add service startup to the update script.

- **Docker daemon (required for Supabase).** Local Supabase runs in Docker. Docker is preinstalled but the daemon does not auto-start (PID 1 is `tini`, not systemd). If `docker ps` fails, start it once: `sudo dockerd > /tmp/dockerd.log 2>&1 &`. The daemon is configured for this VM's kernel in `/etc/docker/daemon.json` (`fuse-overlayfs` storage driver + `containerd-snapshotter` disabled — required for Docker 29) and `iptables` is set to the legacy backend. The `ubuntu` user is in the `docker` group, so `docker`/`supabase` work without `sudo`.
- **Supabase CLI is a devDependency**, not a global binary. Invoke it via `pnpm exec supabase ...` or the `db:*` scripts (`pnpm db:start`, `pnpm db:reset`, `pnpm db:stop`, `pnpm db:types`). First `supabase start` pulls several images (slow); later starts are fast.
- **`.env`:** `.env` is gitignored (never committed); copy it from `.env.example` (the update script does this if missing). Its `NUXT_PUBLIC_SUPABASE_URL` + anon `NUXT_PUBLIC_SUPABASE_KEY` demo values are the real local Supabase values and are all `pnpm dev` needs. `.env.example` leaves `SUPABASE_SERVICE_ROLE_KEY` as a placeholder — E2E does not depend on it because `playwright.config.ts` and `tests/e2e/helpers/e2e-account.ts` fall back to `LOCAL_SUPABASE_SERVICE_ROLE_KEY` from `tests/e2e/local-supabase.ts` (the standard local demo key). Only set it in `.env` if you run service-role calls outside Playwright.
- **Bring the stack up:** with the Docker daemon running, `pnpm db:start` then `pnpm db:reset` (applies `supabase/migrations` + `supabase/seed.sql`). After changing schema, run `pnpm db:types` and commit `app/types/database.types.ts` (CI fails on any diff — see Known pitfalls).
- **Dev server:** `pnpm dev` serves on `http://localhost:3000`. Routes compile on demand, so the very first request to a page can take several seconds or briefly fail to connect before it is ready. For manual auth flows, note `README.md` mentions adding `http://localhost:3000/confirm` to Supabase Auth redirect URLs while `supabase/config.toml` uses `127.0.0.1`; `localhost` and `127.0.0.1` are not interchangeable in the redirect allow-list.
- **E2E:** `pnpm test:e2e` launches its own dev server on port `4173` and targets local Supabase only (it refuses remote URLs). It needs local Supabase running and Playwright's Chromium installed. Chromium is already in the VM snapshot; if it is missing use `pnpm exec playwright install chromium`, and add `--with-deps` (matches CI) when system libraries are also missing. Creating accounts requires email confirmation to be off, which it is in `supabase/config.toml`.
- **Ports:** app `3000` (e2e dev server `4173`), Supabase API `54321`, Studio `54323`, Postgres `54322`, Mailpit `54324`.
