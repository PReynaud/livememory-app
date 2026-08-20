---
title: 'Browse a Shared List and open an Event to join'
type: 'feature'
created: '2026-08-20'
status: 'in-review'
baseline_commit: '3cd3d3394ab04e6f8c956c37d48b91ea252e8747'
review_loop_iteration: 0
context:
  - docs/project-context.md
  - _bmad-output/implementation-artifacts/epic-2-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An enabled `/u/:username` shell from Story 2.4 shows the username and announcer but not Going/Attended Concerts, so visitors cannot browse a night or open an Event to join.

**Approach:** Kernel public Shared List concerts (username lookup, effective Going/Attended only) feed the existing page through domain + Pinia, grouped with Event compact/group rules, read-only, tapping `/e/:id` without joining on the profile.

## Boundaries & Constraints

**Always:**
- Unauthenticated SELECT only via kernel public Shared List lookup (enabled profiles; that User's effective `going`/`attended`; no notes; no unset; no empty Events).
- Effective Attendance is SQL (AD-3), not the raw column.
- No `GRANT SELECT` on a listable view of usernames or of all public concerts — RPC (or equivalent) lookup by username, like `get_shared_list_profile`.
- No create/update/delete/Attendance chips on `/u/:username` (including signed-in someone else). No Add CTA on empty.
- Tapping a grouping navigates to `/e/:id`. That must not insert `event_members`. Join remains the 2.1 signed-in Event URL flow.
- Profile User Concerts on joined (not only owned) Events may appear when Going/Attended.
- Pages do not fetch domain data. Stores call `shared/domain` with a user-scoped client (anon OK). Vue from `vue`, Nuxt from `#imports`.
- After schema change: migration + `pnpm db:types` + commit `app/types/database.types.ts`. No `service_role` on domain tables.

**Ask First:** Changing the 2.4 username lookup into a directory, or starting Story 2.6 / Epic 3.

**Never:** Grant SELECT on `shared_list_profiles` or a public concerts directory; notes on Shared List; write controls on that page; join-on-view; Story 2.6 confirms; editing `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Enabled with Going/Attended | `/u/:username` signed out or as someone else | Visible Concerts grouped compact (1) / Event name (2+); notes, unset, empty Events omitted; no write controls | Load error uses existing "Couldn't load." Retry |
| Enabled empty | Sharing on, no visible Concerts | "Nothing to show yet." No Add CTA. Distinct from "Not found." | N/A |
| Disabled / unknown | Sharing off or bad username | Quiet "Not found." (unchanged) | N/A |
| Tap grouping | Visitor taps compact/group | Opens `/e/:id`; Shared List view did not join | Signed-out Event auth redirect, then 2.1 join |
| After join | Visitor joined from Shared List Event | Full Bill; only own Attendance chips | Existing joiner write blocks |
| Joined Event on list | Profile User Going/Attended on an Event they do not own | Concert may appear; tap opens that Event | N/A |
| Anon REST | Direct table/view reads | May call username concert RPC; cannot SELECT notes, Bill-only, other Attendance, private Events, or the concerts view as a directory | Permission denied / not found |
| Screen reader | Enabled shell loads | Announces "Shared list for {username}"; does not announce missing notes or bill-only Concerts | Auth still excludes `/u/**` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260820030000_shared_list_enable.sql` -- 2.4 profile view + `get_shared_list_profile`; concerts view must follow the same revoke-all + username RPC pattern
- `supabase/migrations/` -- add Shared List concerts view (security definer / `security_invoker = false`) + `get_shared_list_concerts(requested)`; join `attendance` + `concert_is_past` (AD-3); omit `notes`; do not GRANT SELECT on the view
- `shared/domain/shared-list.ts` -- `SHARED_LIST_EMPTY` already exists unused; add concert fetch + Event grouping; keep profile lookup
- `app/stores/shared-list.ts` -- load profile then concert groups; `{ data, error }` + `finally` loading
- `app/pages/u/[username].vue` -- enabled shell, announcer, not-found; render groups with `AppEventCard` readonly; empty copy `SHARED_LIST_EMPTY`; no Add
- `app/components/AppEventCard.vue` -- compact vs group via `isCompactBill` / `groupConcertsByDate`; add `readonly` to hide chips; whole compact card still opens `/e/:id`
- `app/utils/concert-groups.ts` -- reuse, do not fork
- `app/app.vue` -- glass nav already omits `/u/**`; signed-in visitors have no Add chrome on this page
- `nuxt.config.ts` -- auth exclude `/u/**` already
- `tests/unit/shared-list.spec.ts` -- currently asserts page does **not** mention `SHARED_LIST_EMPTY`; invert for enabled-empty; add kernel + domain grouping tests
- `tests/e2e/shared-list.spec.ts` -- enabled-empty currently expects no empty copy; invert; add browse/tap/join/anon REST coverage
- `app/types/database.types.ts` -- regenerate after migration

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/*_shared_list_concerts.sql` -- kernel view + username RPC; revoke SELECT; effective Attendance; no notes; no directory grant
- [x] `shared/domain/shared-list.ts` -- fetch concerts by username; group by Event for compact/group cards
- [x] `app/stores/shared-list.ts` -- load groups through domain; reset loading in `finally`
- [x] `app/components/AppEventCard.vue` -- `readonly` hides Attendance chips; links still go to `/e/:id`
- [x] `app/pages/u/[username].vue` -- render groups or `SHARED_LIST_EMPTY`; no write controls
- [x] `tests/unit/shared-list.spec.ts` -- kernel, grouping, empty vs not-found, readonly surface
- [x] `tests/e2e/shared-list.spec.ts` -- browse, empty, tap-without-join, join-from-list, joined-Event listing, anon SELECT limits
- [x] `app/types/database.types.ts` -- `pnpm db:types` after schema change

**Acceptance Criteria:**
- Given sharing is on and the User has effective going/attended Concerts, when I open `/u/:username` signed out or as someone else, then those Concerts are grouped by Event using compact/group rules, and notes, unset Attendance, empty Events, and write controls are omitted.
- Given I am signed in as someone else, when I view the Shared List, then I still cannot write on that page.
- Given sharing is on but nothing is visible, when I open the profile, then I see "Nothing to show yet." and no Add CTA, distinct from disabled/unknown "Not found."
- Given I tap a grouping, when the Event URL opens, then viewing the Shared List did not join me; join happens on the Event after sign-in.
- Given I joined from a Shared List Event, when I view that Event, then I see the full Bill and can set only my Attendance.
- Given the profile User has Going/Attended on an Event they do not own, then it may appear and tapping opens that Event so I can join it.
- Given unauthenticated reads hit the database, then they may SELECT only the kernel public Shared List lookup, not notes, Bill-only rows, other Users' Attendance, or private Events.
- Given a screen reader on Shared List, when the page loads, then it announces "Shared list for {username}" and does not announce missing notes or bill-only Concerts; auth redirect excludes `/u/**`.

## Spec Change Log

## Design Notes

Readonly Shared List cards use a native `/e/:id` href so a signed-out tap is a document load of the Event URL. Client-side `NuxtLink` from `/u/:username` was redirected to login with `redirect=/u/...` (the profile), which would not join.

## Verification

**Commands:**
- `pnpm lint` -- expected: no errors
- `pnpm typecheck` -- expected: no errors
- `pnpm test:unit` -- expected: pass, including shared-list kernel and grouping
- `pnpm test:e2e tests/e2e/shared-list.spec.ts` -- expected: pass against local Supabase; if Docker/Supabase cannot run, say so in the PR
