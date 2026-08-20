---
title: 'Story 2.4: Enable and disable my Shared List'
type: 'feature'
created: '2026-08-20'
status: 'review'
review_loop_iteration: 0
baseline_commit: '7c0de2c7da99f9a0d1501ddf8460782eb81126a3'
context:
  - docs/project-context.md
  - _bmad-output/implementation-artifacts/epic-2-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Username exists, but there is no opt-in public profile. A visitor who guesses `/u/:username` must not learn whether that User exists, and Event links must keep working on their own.

**Approach:** Persist `profiles.shared_list_enabled`, default off. Profile can enable or disable it and copy the username URL. Enabled `/u/:username` is a public shell without signing in. Disabled and unknown usernames are the same quiet not-found. Concert grouping on that page is Story 2.5.

## Boundaries & Constraints

**Always:**
- Pages do not fetch remote domain data. Pinia + `shared/domain` with a user-scoped client. No `service_role` on domain/profile tables.
- Auto-imports off. Vue from `vue`, Nuxt from `#imports`.
- Sharing helper copy is exact: "Friends see Going and Attended. They can open an Event to join — they never edit your bill or see notes."
- Copy uses the outline primary CTA. Copy failure toast is "Couldn't copy the link."
- Disabled profile and unknown username are the same visitor result. Do not say the User exists but is private.
- Auth redirect excludes `/`, `/login`, `/confirm`, `/u/**`. Auth middleware stays on `/home`, `/concerts`, `/profile`, `/e/:id`.
- Unauthenticated read is a single-username lookup of an enabled profile, not a User directory.
- Event URLs keep working when sharing is off.
- Tests in `tests/unit` and/or `tests/e2e`. Playwright → local Supabase only.

**Ask First:**
- Granting anon SELECT on `profiles` or a listable Shared List view (that is a directory).
- Shipping Going/Attended grouping or "Nothing to show yet." on `/u/:username`.

**Never:**
- Story 2.5 browse/grouping, Event tap-to-join from the list, or the kernel public concert view.
- User search or directory.
- Other stories. Edits to `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- Targeting `main` for the PR; stack on `story/2-3-leave-an-event`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New account | Sharing never enabled | `/u/:username` is quiet not-found, same as unknown username | N/A |
| Enable sharing | Profile toggle on | Flag persisted; `/u/:username` is a public shell without sign-in; Copy link shown | Persist error stays on Profile |
| Copy URL | Outline primary CTA | Clipboard gets origin + `/u/:username` | Toast "Couldn't copy the link." |
| Disable sharing | Toggle off, visitor opens URL | Same quiet not-found as unknown username; no private/exists copy | N/A |
| Event URL | Sharing off | `/e/:id` still works | Existing Event not-found |
| User search | Any surface | None in v1 | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/*_shared_list_enable.sql` -- `profiles.shared_list_enabled` default false. Kernel view `shared_list_profiles` is not granted to anon. `get_shared_list_profile(requested)` is the unauthenticated lookup. Revoke EXECUTE from public. No `service_role`.
- `shared/domain/shared-list.ts` -- `getSharedListProfile` calls the lookup RPC; missing row is quiet `{ data: null, error: null }`.
- `app/stores/profile.ts` -- Own username + sharing flag via user-scoped client. Toggle persist returns `{ data, error }` and resets `loading` in `finally`.
- `app/stores/shared-list.ts` -- Public username lookup for `/u/:username`.
- `app/pages/profile.vue` -- Shared List switch, helper copy, outline Copy link when enabled.
- `app/pages/u/[username].vue` -- No auth middleware. Enabled shell vs quiet "Not found."
- `nuxt.config.ts` -- Auth redirect exclude `/u/**`.
- `tests/unit/shared-list.spec.ts` -- Kernel, domain, Profile/copy guards, quiet not-found, no directory.
- `tests/e2e/shared-list.spec.ts` -- Off/unknown not-found, enable + copy + public shell, copy toast, disable, Event URL still works.

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/shared-list.spec.ts` -- Kernel, domain, surface guards
- [x] `tests/e2e/shared-list.spec.ts` -- Journeys for enable/disable/copy/Event URL
- [x] `supabase/migrations/*_shared_list_enable.sql` -- Flag, view, lookup function
- [x] `shared/domain/shared-list.ts` -- Public lookup
- [x] `app/stores/profile.ts` / `app/stores/shared-list.ts` -- Pinia adapters
- [x] `app/pages/profile.vue` / `app/pages/u/[username].vue` -- Toggle, copy, public shell
- [x] `pnpm db:types` -- commit `app/types/database.types.ts`

**Acceptance Criteria:**
- Given a new account, when sharing was never enabled, then `/u/:username` matches unknown username not-found.
- Given I enable sharing on Profile, then the flag persists, `/u/:username` is reachable signed out, Copy link is the outline primary CTA, and the helper copy is exact.
- Given copy fails, then the toast is "Couldn't copy the link."
- Given I disable sharing, then `/u/:username` matches unknown username and does not say the User exists but is private.
- Given sharing is off, then Event URLs still work.
- Given v1, then there is no User search or directory.

## Spec Change Log

## Design Notes

Unauthenticated visibility is a username lookup, not `GRANT SELECT` on the kernel view. A listable view of enabled usernames would be a User directory (FR-15). Story 2.5 owns Going/Attended grouping, empty "Nothing to show yet.", and the public concert view. The enabled page in this story is only a reachable public shell.

## Verification

**Commands:**
- `pnpm lint` -- expected: exit 0
- `pnpm typecheck` -- expected: exit 0
- `pnpm test:unit` -- expected: shared-list and existing suites pass
- `pnpm test:e2e tests/e2e/shared-list.spec.ts` -- expected: pass against local Supabase when Docker is up
