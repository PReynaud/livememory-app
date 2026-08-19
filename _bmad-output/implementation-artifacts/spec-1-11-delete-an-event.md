---
title: 'Story 1.11: Delete an Event'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
context:
  - docs/project-context.md
  - _bmad-output/implementation-artifacts/epic-1-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An owner can delete a Concert, but cannot delete the Event. Empty nights pile up; a cancelled Bill cannot be removed without orphaning Concerts.

**Approach:** Owner deletes an empty Event immediately with no Concert warning. A non-empty Event deletes only after in-sheet confirm that the Event and all Concerts are destroyed. Kernel cascade removes Concerts, Attendance, and notes. Non-owners are blocked. `/e/:id` after delete is quiet not-found.

## Boundaries & Constraints

**Always:**
- Pages do not fetch remote domain data. Pinia + `shared/domain` with a user-scoped client. No `service_role`.
- Auto-imports off. Vue from `vue`, Nuxt from `#imports`.
- Empty Event delete: owner-only, no Concert warning; `/e/:id` quiet not-found ("Event not found.").
- Non-empty: explicit confirm that the Event and all Concerts are deleted. Attendance and notes go with Concerts. No keep-standalone.
- `concerts.event_id` stays NOT NULL. No Concert survives without an Event.
- Confirm copy must not name joiners (Story 2.6).
- Tests in `tests/unit` and/or `tests/e2e`. Playwright → local Supabase only.

**Ask First:**
- New SQL RPC as the mutation style (spine says TypeScript + RLS first).
- Changing quiet not-found copy away from existing "Event not found."

**Never:**
- Leave Event (later joiner story).
- Joiner-named confirm copy, keep-standalone Concerts, nullable `event_id`.
- Other stories (1.12+). Edits to `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- Targeting `main` for the PR; stack on `story/1-10-onto-main`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty owner delete | Owned Event, 0 Concerts | Event row gone; lists drop it; `/e/:id` quiet not-found; no Concert-warning copy | Persist error stays in the sheet |
| Non-empty without confirm | Owned Event with Concerts; Delete tapped, Cancel | Event, Concerts, Attendance, notes unchanged | N/A |
| Non-empty confirm | Owner confirms in-sheet | Event deleted; Concerts, Attendance, notes gone; no orphan Concert | Persist error stays in the sheet |
| Non-owner | Other user domain/RLS DELETE | Blocked; owner still has the Event | Domain `ownership` / RLS 0-row delete |
| Unknown id | Missing or non-owned Event id | Domain `ownership`; no delete | Same as non-owner |

</frozen-after-approval>

## Code Map

- `shared/domain/events.ts` -- Add `deleteEvent` next to `updateEvent` / `getOwnedEvent`. `EventsClient` already types `delete().eq()`. Reuse `EVENT_RULE.ownership` when `getOwnedEvent` returns null. Kernel cascade does the child deletes; domain only deletes the Event row.
- `app/stores/events.ts` -- `deleteOwnedConcert` is the adapter pattern (`deleteConcert` → `{ data, error }` → `finally` resets `loading`). Add `deleteOwnedEvent` the same way; drop `currentEvent` when it matches; reload owned lists.
- `app/components/AppEditEventSheet.vue` -- Owner already edits here. Reuse `AppAddConcertSheet.vue` in-sheet delete: empty → `removeEvent` immediately; non-empty → `confirmDelete` + copy "This Event and all its Concerts will be deleted." + "Delete event" / Cancel. `navigateTo('/concerts')` on success. No `/joiner/i`.
- `app/pages/e/[id].vue` -- Already quiet not-found. Do not fetch in the page; keep Delete out of a second modal.
- `supabase/migrations/20260819082730_events_owner_delete.sql` -- Owner DELETE RLS already exists. `concerts.event_id` NOT NULL + `ON DELETE CASCADE`; Attendance `ON DELETE CASCADE`. No new migration unless a grant/policy is missing.
- `tests/unit/events-domain.spec.ts` -- Extend mock `events.delete`; cascade mock Concerts; source-guard store/sheet.
- `tests/e2e/events-delete.spec.ts` -- Owner empty delete + quiet not-found; non-empty cancel vs confirm. REST RLS: other user cannot delete.
- Read-only: `tests/e2e/events-create.spec.ts` quiet not-found; `tests/e2e/concerts-edit.spec.ts` Concert delete confirm; `tests/e2e/concerts-rls.spec.ts` other-user DELETE returns empty.

## Tasks & Acceptance

**Execution:**
- [ ] `tests/unit/events-domain.spec.ts` -- Red tests: empty delete, non-empty cascade, ownership, kernel cascade/NOT NULL, store/sheet source guards, no joiner copy
- [ ] `tests/e2e/events-delete.spec.ts` -- Red: empty immediate delete; non-empty cancel; non-empty confirm; RLS owner-only
- [ ] `shared/domain/events.ts` -- `deleteEvent` owner-only Event row delete
- [ ] `app/stores/events.ts` -- `deleteOwnedEvent` adapter
- [ ] `app/components/AppEditEventSheet.vue` -- empty immediate / non-empty confirm in the same sheet; navigate to Concerts

**Acceptance Criteria:**
- Given an Event with zero Concerts, when the owner deletes it, then the Event is gone, `/e/:id` is quiet not-found, and no Concert warning is used.
- Given a non-empty Event, when the owner deletes without confirming, then delete does not complete.
- Given the owner confirms non-empty delete, when it succeeds, then the Event, its Concerts, Attendance, and owner notes are deleted, and no Concert survives without an Event.
- Given a non-owner, when they attempt delete via domain or RLS, then it is blocked.

## Spec Change Log

- Tightened `tests/unit/concerts-domain.spec.ts` update/delete source-guard slices so `moveOwnedConcert`'s `refreshConcertLists` return is not treated as an `updateOwnedConcert` regression, and `deleteOwnedEvent` is checked separately.

## Design Notes

Confirm is UI-only (same as Concert delete). Domain does not take a confirm flag. Empty skip-confirm:

```ts
const requestDelete = () => {
  if (!hasConcerts.value) {
    void removeEvent()
    return
  }
  confirmDelete.value = true
}
```

After success: toast "Event deleted.", close sheet, `navigateTo('/concerts')`.

## Verification

**Commands:**
- `pnpm lint` -- expected: no errors
- `pnpm typecheck` -- expected: no errors
- `pnpm test:unit` -- expected: pass, including new Event-delete cases
- `pnpm test:e2e tests/e2e/events-delete.spec.ts` -- expected: pass against local Supabase when Docker is up
