---
title: 'Story 1.12: Attend this night'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: '03397057d026598352f5cbf9a1761aac4ccbca57'
review_loop_iteration: 0
context:
  - docs/project-context.md
  - _bmad-output/implementation-artifacts/epic-1-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After a soirée, the owner must tap Attendance on every Concert. There is no one-shot for a `single_night` Bill.

**Approach:** On a `single_night` Event, **Attend this night** marks the acting User's Attendance on Concerts currently on that Bill: `going` before the Europe/Paris boundary, `attended` after. No persistent flag. Festivals have no attend-all.

## Boundaries & Constraints

**Always:**
- Pages do not fetch remote domain data. Pinia + `shared/domain` with a user-scoped client. No `service_role`.
- Auto-imports off. Vue from `vue`, Nuxt from `#imports`.
- One-shot on Concerts currently on the Bill. Later-added Concerts start unset. Clearing one Concert leaves it on the Bill unset.
- Status follows `isConcertPast` / kernel: future `going`, past `attended`. Reuse `setAttendance`.
- **Attend this night** is `{components.button-primary}` on `single_night` Event only. Hidden on `festival`. English copy.
- Tests in `tests/unit` and/or `tests/e2e`. Playwright → local Supabase only.

**Ask First:**
- New SQL RPC or a stored attend-all flag on Event.
- Toast copy for attend-all (ACs do not require one).

**Never:**
- Festival attend-all. Persistent later-added flag. Joiner Event surface / Leave Event (Story 2.2 / 2.3).
- Other stories (1.13+). Edits to `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- Targeting `main` for the PR; stack on `story/1-11-delete-an-event`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Future soirée | `single_night` with current Concerts still before Paris boundary | Each current Concert is `going` | Persist error on `attendanceError`; chips unchanged for failed writes |
| Past soirée | `single_night` with current Concerts after Paris boundary | Each current Concert is `attended` | Same persist error path as per-Concert set |
| Later add | After attend-all, owner adds another Concert | New Concert unset; prior rows unchanged | N/A |
| Clear one | After attend-all, clear one Concert | That Concert unset on the Bill; others stay marked | Existing clear path |
| Festival | `festival` Event view | No control that marks every Concert going or attended in one action | Domain rejects attend-all with a named rule if called |

</frozen-after-approval>

## Code Map

- `shared/domain/attendance.ts` -- Add `attendThisNight(client, eventId, now?)`. Load Event kind (reject `festival` with a named rule). List Concerts for that Event. Call existing `setAttendance` per Concert with `isConcertPast`. Do not import `concerts.ts` (it already imports this module). Extend `AttendanceClient.from` with `events` (maybeSingle by id) and `concerts` (eq `event_id` + order). Empty Bill → `{ data: [], error: null }`.
- `app/stores/events.ts` -- `attendThisNight` adapter like `cycleAttendance`: do not set `loading` / `error`; use a night-level busy flag; merge returned rows into `attendanceByConcertId`; `{ data, error }` + `finally`.
- `app/pages/e/[id].vue` -- Render **Attend this night** under the Bill, same outline primary as **Add to this night**, only when `kind === 'single_night'` and `hasConcerts`. Page calls the store only.
- `tests/unit/attendance-domain.spec.ts` -- Extend the mock for `events` / `concerts`. Matrix rows + source-guards (store action, Event CTA, no festival CTA, no `from('attendance')` on pages).
- `tests/e2e/attend-this-night.spec.ts` -- Future night: attend-all → Going; add another → unset; clear one → unset. Past night → Attended. Festival with Concerts → no attend-all control.
- Read-only: `shared/domain/concerts.ts` `applyOwnerAttendanceDefault` (transparent create only — adding onto an Event stays unset); `app/components/AppAttendanceChip.vue`; `supabase/migrations/20260819110138_attendance.sql` (no new flag/migration).

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/attendance-domain.spec.ts` -- Red tests for matrix + Event CTA source-guards
- [x] `tests/e2e/attend-this-night.spec.ts` -- Red journey: soirée attend-all, later add unset, clear one, festival has no control
- [x] `shared/domain/attendance.ts` -- `attendThisNight` one-shot; festival named refuse
- [x] `app/stores/events.ts` -- `attendThisNight` adapter, no global loading
- [x] `app/pages/e/[id].vue` -- **Attend this night** on `single_night` with Concerts only

**Acceptance Criteria:**
- Given a `single_night` Event with Concerts on the Bill, when I tap **Attend this night**, then each current Concert becomes `going` before the Europe/Paris boundary and `attended` after it.
- Given I then add another Concert, when I view Attendance, then the new Concert starts unset.
- Given I clear Attendance on one Concert after attend-all, when clear succeeds, then that Concert stays on the Bill unset.
- Given a `festival` Event, when I view Event, then there is no control that marks every Concert going or attended in one action.

## Spec Change Log

## Design Notes

Domain owns the current Bill snapshot so Pinia cannot pass a stale concert list. Sequential `setAttendance` is enough; no kernel RPC.

```ts
const status = isConcertPast(concert, now) ? 'attended' : 'going'
await setAttendance(client, { concertId: concert.id, status })
```

## Verification

**Commands:**
- `pnpm lint` -- expected: no errors
- `pnpm typecheck` -- expected: no errors
- `pnpm test:unit` -- expected: pass, including attend-all cases
- `pnpm test:e2e tests/e2e/attend-this-night.spec.ts` -- expected: pass against local Supabase when Docker is up
