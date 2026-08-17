# Validation Report — LiveMemory

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/EXPERIENCE.md`
- **Run at:** 2026-08-17T22:00:00+02:00

## Overall verdict

The pair is a coherent Fast-path draft of the owner dark-streaming shell (Home → Concerts → glass Add sheet → Profile → Shared List), with hex tokens, canonical DESIGN.md shape, and named-protagonist flows a consumer can implement. It is not yet a clean contract: UJ-5 / CAP-7 / FR-18 (Event-link join) landed in the PRD and spec while UX was in flight, and is absent from IA, components, states, and Key Flows. FR-14 is cited for the wrong rule (prefill is now FR-7). Architecture and story-dev will invent the joiner path unless those holes are closed.

Only the rubric walker ran (accessibility skipped).

## Category verdicts

- Flow coverage — thin
- Token completeness — adequate
- Component coverage — thin
- State coverage — thin
- Visual reference coverage — thin
- Bloat & overspecification — adequate
- Inheritance discipline — thin
- Shape fit — strong

## Findings by severity

### Critical (2)

**Flow coverage** — Event-link join has no Key Flow (EXPERIENCE.md Information Architecture, Key Flows)

UJ-5 / CAP-7 / FR-18: Sam joins via Event link; signed-in joiner sees shared Bill, sets own Attendance, cannot edit Event/Bill. IA lists Event as Owner only.

Fix: Add Flow 5 (Sam, Event link) with numbered steps, climax, and failures (unknown link; unsigned must sign in; joiner write blocked). Add a joiner Event row to the IA table.

**Inheritance discipline** — Prefill cited as FR-14; PRD FR-14 is now Shared List private-by-default (EXPERIENCE.md Component Patterns → Add sheet)

Prefill is FR-7.

Fix: Cite FR-7 (and FR-12 for locked constraints).

### High (9)

**Flow coverage** — UJ-1 transparent create is not a Key Flow (EXPERIENCE.md Key Flows → Flow 1)

Fix: Retitle Flow 1 and add a transparent-create branch, or add a dedicated UJ-1 flow. Name the PRD UJ on the heading.

**Token completeness** — `{colors.bill-only}` `#737373` on canvas/card is under AA (DESIGN.md Colors → Bill-only)

Fix: Lighten bill-only (or state large-text-only) and record the ratio against canvas and surface-card.

**Component coverage** — Event-link copy (FR-18) is not a component (EXPERIENCE.md Sharing controls; DESIGN.md Components)

Fix: Event-view control: copy unguessable Event link, helper that it is not the public profile.

**Component coverage** — Event picker has behavior only, no visual spec (EXPERIENCE.md Event picker)

Fix: Anatomy, hierarchy of New night / New festival, field layout on glass.

**State coverage** — Unsigned visitor on Event link must sign in; no state (EXPERIENCE.md State Patterns)

Fix: Event-link entry: redirect/sign-in, then Bill; unknown link = quiet not-found.

**State coverage** — Joiner Event states missing (EXPERIENCE.md State Patterns)

Fix: Hide write controls; joiner cold-load/empty-Bill row.

**Inheritance discipline** — Key Flows never use verbatim UJ-1…UJ-5 / CAP-* names (EXPERIENCE.md Key Flows)

Fix: Headings like `### Flow 1 — UJ-2. Pierre sets up a single-night Event, then the Bill`.

**Inheritance discipline** — Glossary omits Event link, Event owner, Place, Stage or Scene (EXPERIENCE.md opening)

Fix: Same glossary list as entities.md; Event link in IA + components.

**Inheritance discipline** — PRD FR-4 copy is "J'y vais"; spine commits English "Going" (EXPERIENCE.md Voice and Tone vs prd.md FR-4)

Fix: Explicit PRD override or bilingual label. Do not leave ASSUMPTION vs final PRD.

### Medium (12)

**Flow coverage** — FR-1 / SM-1 first-run has no journey (EXPERIENCE.md IA, Key Flows)

Fix: Short Pierre first-run flow, or an explicit “covered by Flow 1 after Sign in” line that names FR-1.

**Token completeness** — No numeric contrast targets except muted-on-canvas (DESIGN.md Colors)

Fix: One small table of load-bearing pairs + WCAG 2.2 AA ratios.

**Component coverage** — One-sided specs: Primary button visual only; Attend this night / Sharing / Validation behavioral only; toast unnamed (DESIGN.md / EXPERIENCE.md Components)

Fix: Pair each, or one line “inherits Nuxt UI with no brand delta.”

**Component coverage** — Featured Event has no YAML `components.featured-event` token (DESIGN.md frontmatter)

Fix: Add a token block (or state it is Event group + `{typography.display-sm}` only).

**Component coverage** — Names drift: Stat count vs Home stats; Attendance chips vs chip; Glass nav vs Glass nav Add

Fix: One canonical name per component in YAML, DESIGN, and EXPERIENCE.

**State coverage** — Sign in / Register has no invalid-credentials, duplicate-email, or submitting state

Fix: Named-rule errors; stay on the form.

**State coverage** — Profile / fetch-error / Shared List cold-load gaps

Fix: Skeleton + named failure per fetch surface; Profile copy failure toast.

**Visual reference coverage** — Tidal import not linked from chrome/nav; EXPERIENCE Inspiration omits filename

Fix: Inline `imports/tidal-home-frosted-chrome.png` at glass nav / Elevation; name what it illustrates.

**Visual reference coverage** — No LiveMemory composition mocks (mockups/ absent)

Fix: At least one HTML mock of Add sheet over an Event, or an explicit spine-only log.

**Bloat** — Attendance & Bill restates SPEC/PRD (EXPERIENCE.md Attendance & Bill)

Fix: Keep only UX deltas; point at the spec for the rest.

**Inheritance discipline** — `entities.md` not in `sources:` lists

Fix: Add `_bmad-output/specs/spec-livememory/entities.md`.

**Inheritance discipline** — Source paths mix repo-root and workspace-relative

Fix: One resolution root; peer DESIGN.md as a documented sibling.

### Low (5)

**Flow coverage** — Flow 3 has no failure path

Fix: Empty Concerts / copy-link failure, or state that read-only nostalgia has no write failure.

**Token completeness** — `md` inset is raw 24px; unused `{spacing.gutter}` / `{spacing.section}`

Fix: Tokenize the md inset or drop unused keys.

**State coverage** — No loading-more / truncated-list state for ~1,000 Concerts NFR

Fix: One Concerts row: window or page, keep chrome-safe padding.

**Visual reference coverage** — Spines-win-on-conflict not stated beside the Tidal import; missing from DESIGN.md

Fix: One sentence in both files.

**Bloat** — Interaction Primitives DESIGN-like narrative; Assumptions Index repeats in-body tags

Fix: Imperative bullets only; one assumption list.

## Reviewer files

- `review-rubric.md`
