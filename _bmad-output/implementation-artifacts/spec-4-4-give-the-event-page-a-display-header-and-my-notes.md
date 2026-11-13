---
title: 'Story 4.4: Give the Event page a display header and my notes'
type: 'feature'
created: '2026-11-13'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/_bmad-output/design/handoff-live-pulse.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Event page header is a title and a muted date line; notes written in the Add sheet are never shown on the page.

**Approach:** Add a date stack and a place line with a pin to the header, move the single-night Going chip into the header, and show the owner's concert notes (one "My notes" card for a compact bill, a clamped line under each row for multi-concert bills).

## Boundaries & Constraints

**Always:** Notes render only when `isOwner`. Joiner Attendance stays private. Edit, share, add, leave, and delete flows unchanged.

**Ask First:** Editing notes inline on the page.

**Never:** Photos, setlist / details / memories tabs, friends, favorites heart.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Owner, one concert, notes | notes "Front row" | "My notes" card with text | N/A |
| Owner, festival, notes on one row | row note | muted clamped line under that row | N/A |
| Owner, no notes | all null | no notes block | N/A |
| Joiner | notes unreadable | no notes block | N/A |

</frozen-after-approval>

## Code Map

- `app/pages/e/[id].vue` -- header, chip placement, notes
- `app/utils/event-dates.ts` -- `formatDateStack` (from 4.2)
- `app/assets/css/main.css` -- `.lm-date-stack` (from 4.2)
- `tests/unit/event-detail-design.spec.ts` (new), `tests/e2e/event-join.spec.ts` / new `tests/e2e/event-notes.spec.ts`

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/event-detail-design.spec.ts` -- notes gated by `isOwner`; date stack in header -- red first
- [x] `app/pages/e/[id].vue` -- date stack + title row, place line with `i-lucide-map-pin`, single-night chip in header, owner notes
- [x] `tests/e2e/event-notes.spec.ts` -- owner sees notes; joiner does not

**Acceptance Criteria:**
- Given an owned single-concert Event with notes, when opened, then "My notes" shows the text.
- Given the same Event opened by a joiner, then no notes text is in the page.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test:unit` -- expected: all pass
- `pnpm test:e2e` -- expected: all pass on local Supabase

## Spec Change Log

- Implementation: the header icon buttons (`.lm-header-icon`) had no CSS; they now render as 44px round targets. The Epic 2 source assertion in `tests/unit/joiner-attendance.spec.ts` that banned `concert.notes` on the page now requires every notes render to be guarded by `isOwner &&` (notes remain unreadable to joiners through `concert_notes`).
