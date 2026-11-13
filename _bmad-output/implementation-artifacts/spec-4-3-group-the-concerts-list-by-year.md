---
title: 'Story 4.3: Group the Concerts list by year'
type: 'feature'
created: '2026-11-13'
status: 'ready-for-dev'
review_loop_iteration: 0
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/_bmad-output/design/handoff-live-pulse.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Concerts list is one flat stack of cards; years of history are hard to scan and dates sit in meta text.

**Approach:** Group the already-listed (filtered, paginated) Events under year headings, and lead each Event row with a compact date stack.

## Boundaries & Constraints

**Always:** Group after pagination so Load more appends into the right year. Keep `role="tabpanel"`, tab ids, filter sheet, empty / loading / error states, and copy.

**Ask First:** Sticky headings, an All tab, or new filters.

**Never:** Favorites, hearts, genre chips, counts per year.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Two years | Events 2025-04, 2025-03, 2024-11 | `[{2025,[a,b]},{2024,[c]}]` | N/A |
| Order kept | Upcoming ascending 2026-12, 2027-01 | `[{2026},{2027}]` | N/A |
| Interleaved | 2025, 2024, 2025 | three groups, order kept | N/A |
| Empty | `[]` | `[]` | N/A |

</frozen-after-approval>

## Code Map

- `app/utils/concert-list-filters.ts` -- add `groupEventsByYear`
- `app/pages/concerts.vue` -- year sections around `AppEventCard`
- `app/components/AppEventCard.vue` -- `row` variant with compact date stack
- `tests/unit/concert-list-filters.spec.ts`, `tests/e2e/concerts-list.spec.ts`

## Tasks & Acceptance

**Execution:**
- [ ] `tests/unit/concert-list-filters.spec.ts` -- `groupEventsByYear` matrix -- red first
- [ ] `app/utils/concert-list-filters.ts` -- `groupEventsByYear(events)` consecutive grouping by `start_date` year
- [ ] `app/components/AppEventCard.vue` -- `row` variant: compact date stack leading the existing compact / group body
- [ ] `app/pages/concerts.vue` -- `<section>` per year with `<h2>` year heading, cards in `row` variant
- [ ] `tests/e2e/concerts-list.spec.ts` -- seed two years, assert headings in order

**Acceptance Criteria:**
- Given Events in 2025 and 2024 on the Past tab, when the list renders, then heading "2025" precedes "2024" and each Event sits under its year.
- Given Load more, when new Events arrive in an existing year, then no duplicate heading appears.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test:unit` -- expected: all pass
- `pnpm test:e2e` -- expected: all pass on local Supabase
