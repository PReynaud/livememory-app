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
