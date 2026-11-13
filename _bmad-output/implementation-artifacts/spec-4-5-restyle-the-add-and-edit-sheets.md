---
title: 'Story 4.5: Restyle the Add and Edit sheets'
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

**Problem:** The Add and Edit sheets still use white text literals and grey glass tuned for a black canvas.

**Approach:** Move sheet panels, wells, and the event context onto navy token surfaces, use `var(--fg)` instead of `text-white`, keep cyan focus from 4.1, and keep the attendance / day choice selected state pink-filled with black text.

## Boundaries & Constraints

**Always:** Same fields, Event picker, attach / create confirm, validation, and keyboard shortcut. Primary stays outline.

**Ask First:** Any field, segmented mode, or tag input.

**Never:** Manual / From-an-event tabs, tags, venue/country split.

</frozen-after-approval>

## Code Map

- `app/assets/css/main.css` -- `.lm-sheet-shell`, `.lm-sheet-foot`, `.lm-form-panel*`, `.lm-event-context`, `.lm-option-chip`
- `app/components/AppAddConcertSheet.vue` -- `text-white` literals
- `app/components/AppEditEventSheet.vue` -- `text-white` literals
- `tests/unit/add-concert-sheet.spec.ts`

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/add-concert-sheet.spec.ts` -- sheets use token text, no `text-white`; selected option chip filled pink with black text -- red first
- [x] `app/assets/css/main.css` -- navy glass mixes on `--surface` / `--surface-alt`; selected `.lm-option-chip` filled pink, black text
- [x] `app/components/AppAddConcertSheet.vue`, `app/components/AppEditEventSheet.vue` -- `text-white` to `text-[var(--fg)]`

**Acceptance Criteria:**
- Given the Add sheet, when opened, then panels render on navy surfaces and the existing add, edit, and attach e2e journeys pass unchanged.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test:unit` -- expected: all pass
- `pnpm test:e2e` -- expected: all pass on local Supabase

## Spec Change Log

- Implementation: focused fields still drew Nuxt UI's pink `ring-primary`, which contradicts "keep cyan focus". `app/app.config.ts` now extends `input`, `inputMenu`, `select`, and `textarea` with a cyan ring and outline for the primary color. The unused `.lm-option-chip` selected state is pink-filled with black text, matching the festival day chip.
