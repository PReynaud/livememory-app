# Project context for BMAD

- Conversation language follows the user (English or French). All produced artifacts are English.
- Unit tests live in `tests/unit`. End-to-end tests live in `tests/e2e`.
- Every story must add or update tests. Prefer red-green-refactor.
- Playwright targets local Supabase only.
- Shared state and remote fetching belong in Pinia stores, not pages.
- Schema changes go in `supabase/migrations` with RLS. Do not add Prisma.
