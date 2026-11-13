---
title: 'Story 4.2: Lead Home with the next concert'
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

**Problem:** Home lists upcoming Events as equal cards, so the next concert does not stand out, and the date is buried in a meta line.

**Approach:** Render the first featured Event as a hero (date stack, display title, place, Attendance chip, CSS atmosphere) and restyle Last night as a quiet memory card with a compact date stack. Stats stay one horizontal card.

## Boundaries & Constraints

**Always:** Same store data (`featuredEvents`, `lastNightEvent`, `homeStats`). Keep `data-testid`s `home-featured`, `home-featured-empty`, `home-last-night`, `home-stats`. Atmosphere is `aria-hidden` CSS only and is not displayed under `prefers-reduced-motion: reduce`.

**Ask First:** Any image, artwork, or new Home section.

**Never:** Pink stat numbers, tappable stats, photos, friends, tickets, genre chips.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Date stack | `2025-04-26` | `{ weekday: 'SAT', day: '26', month: 'APR', year: '2025' }` | N/A |
| Year boundary | `2026-01-01` | `THU`, `1`, `JAN`, `2026` | N/A |
| Invalid | `not-a-date` | `{ weekday: '', day: 'not-a-date', month: '', year: '' }` | No throw |
| Long name | 90-character artist | Title wraps, no horizontal overflow | N/A |

</frozen-after-approval>

## Code Map

- `app/utils/event-dates.ts` -- add `formatDateStack`
- `app/components/AppEventCard.vue` -- `hero` and `memory` variants
- `app/pages/home.vue` -- hero for first featured Event, memory card for Last night
- `app/assets/css/main.css` -- `.lm-date-stack`, `.lm-hero`, `.lm-hero-atmosphere`, reduced-motion rule
- `tests/unit/home-featured.spec.ts`, `tests/e2e/home-featured.spec.ts`

## Tasks & Acceptance

**Execution:**
- [ ] `tests/unit/dates-domain.spec.ts` -- `formatDateStack` matrix -- red first
- [ ] `app/utils/event-dates.ts` -- `formatDateStack(iso)` UTC-safe, uppercase en-GB parts
- [ ] `app/assets/css/main.css` -- date stack, hero, atmosphere (gradient + slow drift), `display: none` under reduced motion
- [ ] `app/components/AppEventCard.vue` -- `variant?: 'default' | 'hero' | 'memory'` prop; hero = date stack + display title + pinned place + chip + atmosphere; memory = compact stack + title
- [ ] `app/pages/home.vue` -- first featured as hero, rest featured; Last night as memory
- [ ] `tests/unit/home-featured.spec.ts` -- hero once, `aria-hidden` atmosphere, reduced-motion rule
- [ ] `tests/e2e/home-featured.spec.ts` -- long artist name fits a 390px viewport; reduced motion hides atmosphere

**Acceptance Criteria:**
- Given two upcoming Events, when Home loads, then exactly one hero renders and the second is a featured card.
- Given reduced motion, when Home renders, then `.lm-hero-atmosphere` is not visible.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test:unit` -- expected: all pass
- `pnpm test:e2e` -- expected: all pass on local Supabase
