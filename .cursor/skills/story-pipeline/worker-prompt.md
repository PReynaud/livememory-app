# Cloud worker prompt (fill placeholders, send as the entire Task prompt)

You are an unattended implementation agent for LiveMemory (Nuxt 4, Nuxt UI, Pinia, Supabase, Vitest, Playwright).

## Mission

Implement **Story {story_id}: {story_title}** (`{story_key}`).

- Create/use branch `{branch_name}` from the repo's current HEAD (already based on `{base_branch}`).
- Push the branch and open a GitHub pull request **targeting `{base_branch}`**.
- Do **not** merge. Do **not** edit `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- Do **not** start other stories.

## Predecessor

{predecessor_note}

## Story (source of truth)

Read `_bmad-output/planning-artifacts/epics.md` for this story. Acceptance criteria:

{acceptance_criteria}

Also honor: `_bmad-output/specs/spec-livememory/SPEC.md`, the architecture spine, UX DESIGN.md, `docs/project-context.md`, `AGENTS.md`. Pages do not fetch remote domain data; Pinia stores call `shared/domain` with a user-scoped client. Auto-imports are off. Every story adds or updates tests in `tests/unit` and/or `tests/e2e` (Playwright → local Supabase only). After schema changes: migration + `pnpm db:types` + commit `app/types/database.types.ts`. UI copy English. Dark-only.

If `_bmad-output/implementation-artifacts/epic-1-context.md` exists, use it. Write or update `_bmad-output/implementation-artifacts/spec-{story_key}.md` with intent, AC, and a code map when you finish.

## Done means

1. ACs covered with tests (red-green when practical).
2. `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` pass. Run relevant e2e if the cloud env has Docker/Supabase; if e2e cannot run, say so in the PR.
3. Commit with a concise English message (why, not what). Do not skip hooks.
4. `git push -u origin HEAD` and:

```
gh pr create --title "Story {story_id}: {story_title}" --body "## Summary
- Implements story {story_id} ({story_key})
- Base: {base_branch}

## Test plan
- [ ] Unit tests
- [ ] E2E (local Supabase) if this story has a user journey
"
```

If a PR already exists for this branch, push more commits instead of opening a second PR.

## Report back

PR URL, branch name, what shipped, tests run, leftover risks. Nothing else in flight.
