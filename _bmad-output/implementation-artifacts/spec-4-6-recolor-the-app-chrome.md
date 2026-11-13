---
title: 'Story 4.6: Recolor the app chrome'
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

**Problem:** The nav marks the active route with a pink fill (Going's colour), Add is a white circle, and the logo is a generic letter mark.

**Approach:** Active nav item turns cyan with `aria-current="page"`, Add becomes a pink outline circle, and the logo becomes an equalizer-bar wordmark shown in the header and on the desktop rail.

## Boundaries & Constraints

**Always:** Exactly four targets: Home, Concerts, Add, Profile. 44px touch targets. Frost stays.

**Ask First:** Any new destination.

**Never:** MCP, Settings, Events, or Shared list as nav items; search in chrome; notification bell.

</frozen-after-approval>

## Code Map

- `app/components/AppGlassNav.vue` -- active state, Add launcher, rail logo
- `app/components/AppLogo.vue` -- equalizer mark
- `app/components/AppHeader.vue` -- wordmark "LiveMemory"
- `tests/unit/app-chrome.spec.ts` (new)

## Tasks & Acceptance

**Execution:**
- [ ] `tests/unit/app-chrome.spec.ts` -- `aria-current`, cyan active, four targets, outline Add, wordmark -- red first
- [ ] `app/components/AppGlassNav.vue` -- cyan active pill, `aria-current`, pink outline Add, rail logo on `lg`
- [ ] `app/components/AppLogo.vue` -- equalizer bars (`currentColor` + pink)
- [ ] `app/components/AppHeader.vue` -- "LiveMemory" wordmark

**Acceptance Criteria:**
- Given `/concerts`, when the nav renders, then the Concerts link has `aria-current="page"` and the others do not.
- Given the nav, then it has exactly four targets.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test:unit` -- expected: all pass
- `pnpm test:e2e` -- expected: all pass on local Supabase
- `pnpm build:vercel` -- expected: prerender succeeds
