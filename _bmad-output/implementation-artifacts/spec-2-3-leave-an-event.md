---
title: 'Story 2.3: Leave an Event'
type: 'feature'
created: '2026-08-20'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: '0dc335ad49cc01b47c1836fdf6d74d39ca328fd5'
context:
  - docs/project-context.md
  - _bmad-output/implementation-artifacts/epic-2-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A joiner can open an Event URL and set Attendance, but cannot leave. The Event stays on their Home and Concerts even when they no longer want it.

**Approach:** Joiners confirm Leave Event, then domain deletes their `event_members` row. The kernel also deletes that User's Attendance on the Event's Concerts. The Bill is unchanged. Opening the URL while signed in joins again.

## Boundaries & Constraints

**Always:**
- Pages do not fetch remote domain data. Pinia + `shared/domain` with a user-scoped client. No `service_role`.
- Auto-imports off. Vue from `vue`, Nuxt from `#imports`.
- Confirm copy is exact: "Leave this Event? It will leave your list. The bill stays for the owner."
- Leave is a quiet control, not `{components.button-primary}`. Destructive color is only on the confirm action.
- Owners do not Leave (hidden, not disabled).
- Leave deletes membership + that User's Attendance on that Event's Concerts. Owner and other joiners keep the Bill and their Attendance.
- Rejoin is existing join-on-open of `/e/:id`.
- Tests in `tests/unit` and/or `tests/e2e`. Playwright → local Supabase only.

**Ask First:**
- New SQL RPC as the mutation style (spine says TypeScript + RLS first).
- Changing confirm copy.

**Never:**
- Shared List (2.4–2.5), joiner-impact confirms (2.6), owner Leave, kick, roster, or link rotation.
- Other stories. Edits to `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- Targeting `main` for the PR; stack on `story/2-2-set-my-own-attendance-as-a-joiner`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Joiner taps Leave | Signed-in joiner on `/e/:id` | Quiet Leave Event; confirm copy shown. Not primary CTA | N/A |
| Confirm leave | Joiner confirms | Membership gone; that User's Attendance on Event Concerts gone; Event gone from Home and Concerts; navigate to Concerts | Persist error stays on the Event page |
| Cancel leave | Confirm shown, Cancel | Membership and Attendance unchanged | N/A |
| Owner / other joiner | After A leaves | Owner Bill + notes unchanged; other joiner membership and Attendance unchanged | N/A |
| Owner surface | Owner on `/e/:id` | No Leave Event control | Domain `owner_cannot_leave` if called |
| Rejoin | Left joiner opens Event URL signed in | Join inserts membership again; Bill visible | Existing join errors |

</frozen-after-approval>

## Code Map

- `supabase/migrations/*_event_members_leave.sql` -- GRANT DELETE on `event_members`; RLS DELETE own row (`(select auth.uid()) = user_id`). BEFORE DELETE trigger (SECURITY INVOKER) deletes that `user_id`'s `attendance` on Concerts for `old.event_id` while Concerts are still visible. Revoke EXECUTE. No `service_role`. Join migration stays insert/select-only.
- `shared/domain/membership.ts` -- Add `leaveEvent` next to `joinEvent`. Visible Event + own membership → DELETE `event_members` by `event_id` (RLS scopes the row; trigger clears Attendance). Visible Event with no membership → owner, refuse. Unknown Event → quiet `{ data: null, error: null }` like join.
- `app/stores/events.ts` -- `leaveJoinedEvent` mirrors `deleteOwnedEvent`: offline guard, `{ data, error }`, `finally` resets `loading`, clear `currentEvent` when it matches, `reloadOwnedConcertState`.
- `app/pages/e/[id].vue` -- Joiner-only quiet Leave Event (`neutral` link/ghost, not primary outline). In-page confirm (no second modal). Confirm action `color="error"`. Success `navigateTo('/concerts')`. Hide Leave for `isOwner`.
- `tests/unit/event-leave.spec.ts` -- Kernel SQL, domain leave/owner/unknown, store/page source guards, exact confirm copy, Leave not primary.
- `tests/e2e/event-leave.spec.ts` -- Confirm copy; cancel; confirm deletes membership + Attendance and drops lists; owner Bill and other joiner unchanged; rejoin via URL; owner has no Leave control.
- Read-only: `shared/domain/events.ts` `getOwnedEvent` / `EVENT_RULE.ownership`; `app/stores/events.ts` `fetchEvent` join-on-open; `tests/unit/event-join.spec.ts` join migration still has no DELETE.

## Tasks & Acceptance

**Execution:**
- [ ] `tests/unit/event-leave.spec.ts` -- Red tests for kernel, domain, store/page guards
- [ ] `tests/e2e/event-leave.spec.ts` -- Red journey: confirm, cancel, leave, lists, other joiner, rejoin, owner hidden
- [ ] `supabase/migrations/*_event_members_leave.sql` -- DELETE grant, own-row policy, Attendance cleanup trigger
- [ ] `shared/domain/membership.ts` -- `leaveEvent`
- [ ] `app/stores/events.ts` -- `leaveJoinedEvent`
- [ ] `app/pages/e/[id].vue` -- quiet Leave Event + in-page confirm
- [ ] `pnpm db:types` -- commit `app/types/database.types.ts` if it changes

**Acceptance Criteria:**
- Given I am a joiner, when I tap Leave Event, then I see "Leave this Event? It will leave your list. The bill stays for the owner." and Leave is not a primary button.
- Given I confirm leave, when it succeeds, then my `event_members` row and my Attendance on that Event's Concerts are deleted, and the Event leaves Home and Concerts.
- Given I confirm leave, when it succeeds, then the Bill is unchanged for the owner and other joiners.
- Given I open the Event URL while signed in after leaving, then I join again.
- Given I own the Event, when I view `/e/:id`, then Leave Event is not shown.

## Spec Change Log

## Design Notes

Leave is a domain DELETE of `event_members`, not a second Attendance loop in TypeScript. Attendance DELETE RLS requires Concert visibility, so cleanup must run BEFORE membership is gone (trigger on the same statement). Domain still refuses owners so a stray adapter call cannot no-op as success. Rejoin is `fetchEvent` → `joinEvent` from 2.1; do not add a second join path.

## Verification

**Commands:**
- `pnpm lint` -- expected: exit 0
- `pnpm typecheck` -- expected: exit 0
- `pnpm test:unit` -- expected: event-leave and existing suites pass
- `pnpm test:e2e tests/e2e/event-leave.spec.ts` -- expected: pass against local Supabase when Docker is up
