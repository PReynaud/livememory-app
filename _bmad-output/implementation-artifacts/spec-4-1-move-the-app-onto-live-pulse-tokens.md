---
title: 'Story 4.1: Move the app onto Live Pulse tokens'
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

**Problem:** The app paints a true-black canvas with neutral grey surfaces and pink focus rings; the approved Live Pulse direction needs a navy canvas and a cyan focus colour before any screen is reshaped.

**Approach:** Swap the CSS tokens in `main.css`, add `--surface-alt` and `--focus`, route every focus ring and the selected Concerts tab through cyan, and replace hard-coded neutral hexes in components with token variables. Lock contrast with a unit test that reads the tokens.

## Boundaries & Constraints

**Always:** Pink `#FF4D8A` and the `going-*` scale stay unchanged. Going chips, filter chips, selected choice chips, and outline CTAs stay pink. Dark-only.

**Ask First:** Any change to button variants (filled / glow), or any new hue beyond cyan.

**Never:** Layout or copy changes. Store, schema, or route changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Focus ring | Tab onto any control | 2px cyan outline | N/A |
| Attendance chip focus | Tab onto Going or Attended chip | Cyan ring, chip colours unchanged | N/A |
| Selected tab | Upcoming / Past selected | Cyan border, cyan count | N/A |

</frozen-after-approval>

## Code Map

- `app/assets/css/main.css` -- token block, focus ring, list tabs
- `app/components/AppAttendanceChip.vue` -- per-status focus ring and Attended grey
- `app/components/AppListSkeleton.vue` -- hard-coded `#1A1A1A`
- `app/components/AppGlassNav.vue` -- hard-coded white text and border
- `app/components/AppEventCard.vue`, `app/pages/e/[id].vue` -- `border-white/8` hairlines
- `tests/unit/polish-lists.spec.ts`, `tests/unit/attendance-domain.spec.ts` -- source assertions on old hexes

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/helpers/contrast.ts` -- WCAG relative-luminance ratio helper -- shared by token tests
- [x] `tests/unit/design-tokens.spec.ts` -- parse `main.css` tokens; assert palette and contrast pairs -- red first
- [x] `app/assets/css/main.css` -- navy tokens, `--surface-alt`, `--focus`, cyan `:focus-visible`, cyan selected tab -- the pass itself
- [x] `app/components/AppAttendanceChip.vue` -- cyan focus ring; Attended/unset via `var(--muted)` -- one focus colour
- [x] `app/components/AppListSkeleton.vue`, `AppGlassNav.vue`, `AppEventCard.vue`, `app/pages/e/[id].vue` -- token variables instead of neutral hexes / `white/8`
- [x] `tests/unit/polish-lists.spec.ts`, `tests/unit/attendance-domain.spec.ts` -- update neutral-hex assertions

**Acceptance Criteria:**
- Given `main.css`, when tokens are parsed, then foreground, muted, and pink on canvas and surface are at least 4.5:1, and cyan on canvas is at least 3:1.
- Given any screen, when rendered, then no component hard-codes `#000000`, `#1A1A1A`, or `#A3A3A3`.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test:unit` -- expected: all pass
- `pnpm test:e2e` -- expected: all pass on local Supabase
- `pnpm build:vercel` -- expected: prerender succeeds
