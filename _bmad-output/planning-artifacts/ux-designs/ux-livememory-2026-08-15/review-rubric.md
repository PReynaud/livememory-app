# Spine Pair Review — LiveMemory

## Overall verdict

The pair is a coherent Fast-path draft of the **owner** dark-streaming shell (Home → Concerts → glass Add sheet → Profile → Shared List), with hex tokens, canonical DESIGN.md shape, and three named-protagonist flows that a consumer can implement. It is **not yet a clean contract**: UJ-5 / CAP-7 / FR-18 (Event-link join) is absent from IA, components, states, and Key Flows; UJ-1’s transparent create is not a flow; FR-14 is cited for the wrong rule; component names drift; bill-only contrast is likely below AA. Architecture and story-dev will invent the joiner path and several treatments unless those holes are closed.

## 1. Flow coverage — thin

Checked PRD **UJ-1…UJ-5**, SPEC **CAP-1…CAP-7**, and memlog jobs (soirée add, festival plan, pre-event desire, nostalgia). EXPERIENCE.md Key Flows: Flow 1 (Pierre, soirée bill — climax + failure), Flow 2 (Pierre, festival — climax + failure), Flow 3 (Pierre, Home/Concerts nostalgia — climax, no failure), Flow 4 (Sam, Shared List — climax + failure). Mapped: UJ-2≈Flow 1, UJ-3≈Flow 2, UJ-4≈Flow 4. Unmapped: UJ-1, UJ-5. CAP-6 correctly declared non-screen.

### Findings

- **critical** UJ-5 / CAP-7 / FR-18 (Sam joins via Event link: signed-in joiner sees shared Bill, sets own Attendance, cannot edit Event/Bill) has no Key Flow. IA lists Event as **Owner** only; no joiner Event surface, no copy-Event-link step, no unsigned-visitor → sign-in beat (EXPERIENCE.md Information Architecture, Key Flows). *Fix:* Add Flow 5 (Sam, Event link) with numbered steps, climax, and failures (unknown link; unsigned must sign in; joiner write blocked). Add a joiner Event row to the IA table.
- **high** UJ-1 (Pierre logs a one-performer show; Add Concert transparently creates `single_night`) is not a Key Flow. Flow 1 is Event-first **New night** then multi-artist Bill (UJ-2), not transparent create from artist+date+Place (EXPERIENCE.md Key Flows → Flow 1; PRD UJ-1). *Fix:* Either retitle Flow 1 and add a transparent-create branch with a climax, or add a dedicated UJ-1 flow. Name the PRD UJ on the heading.
- **medium** FR-1 / SM-1 first-run (register → Home → first Event-backed Concert in under 3 minutes) has no journey. Sign in / Register is an IA row only (EXPERIENCE.md Information Architecture, Key Flows). *Fix:* A short Pierre first-run flow, or an explicit “covered by Flow 1 after Sign in” line that names FR-1.
- **low** Flow 3 has numbered steps and a climax but no failure path (EXPERIENCE.md Key Flows → Flow 3). *Fix:* Empty Concerts / empty featured / copy-link failure, or state that read-only nostalgia has no write failure.

## 2. Token completeness — adequate

Extracted DESIGN.md YAML: `colors` (11, all hex), `typography` (5 roles), `rounded` (5), `spacing` (5), `components` (8). Prose `{path.to.token}` refs in both spines resolve except template slots `{name}` / `{username}` (a11y copy, not tokens). Dark-only is `[ASSUMPTION]`-tagged; no light/dark pairs required. Platform/Nuxt UI inheritance stays semantic (`fontFamily: inherit`).

### Findings

- **high** `{colors.bill-only}` `#737373` on `{colors.canvas}` `#000000` is ~4.4:1 (under AA 4.5:1 for body text) and on `{colors.surface-card}` `#1A1A1A` ~3.6:1. Owner Event “On the bill” rows sit on event-group cards (DESIGN.md Colors → Bill-only; Components → Concert row / Attendance chips). No contrast target for this pair. *Fix:* Lighten bill-only (or state large-text-only) and record the ratio against canvas **and** surface-card.
- **medium** Only muted-on-canvas is told to meet AA; no numeric targets for foreground, muted, attended, destructive, or going-chip (white/black) (DESIGN.md Colors; EXPERIENCE.md Accessibility Floor). *Fix:* One small table of load-bearing pairs + WCAG 2.2 AA ratios.
- **low** Horizontal inset at `md` is raw `24px` while `{spacing.page-x}` is `16px`; `{spacing.gutter}` and `{spacing.section}` are defined and never referenced (DESIGN.md Layout & Spacing; frontmatter `spacing`). *Fix:* Tokenize the `md` inset or drop unused keys.

## 3. Component coverage — thin

Names used: Glass nav, Event group, Featured Event, Concert row, Attendance chip(s), Add sheet, Primary button, Stat count / Home stats, Event picker, Attend this night, Glass nav Add, Sharing controls, Validation alert; plus inherited `UButton`, `UForm`, `UCard`, `UModal`/`USlideover`, `UAlert`, `UBadge`, `UNavigationMenu`, `USkeleton`, `UEmpty`; plus toast (Add sheet save) and Event-link copy (FR-18, sources only). DESIGN.md.Components visual rows: Glass nav, Event group, Featured Event, Concert row, Attendance chips, Add sheet, Primary button, Stat count. EXPERIENCE.md Component Patterns: Event group, Featured Event, Concert row, Add sheet, Event picker, Attend this night, Attendance chip, Glass nav Add, Home stats, Sharing controls, Validation alert.

### Findings

- **high** Event-link copy (FR-18) is not a component in either spine; Profile Sharing controls cover only the username Shared List URL (EXPERIENCE.md Component Patterns → Sharing controls; DESIGN.md Components). *Fix:* Event-view control: copy unguessable Event link, helper that it is not the public profile.
- **high** Event picker is load-bearing (search Events, **New night**, **New festival**) with behavioral rules only — no DESIGN.md.Components visual spec (EXPERIENCE.md Component Patterns → Event picker; DESIGN.md Components). *Fix:* Anatomy, hierarchy of the two create paths, and field layout on glass.
- **medium** One-sided specs: **Primary button** visual only; **Attend this night** / **Sharing controls** / **Validation alert** behavioral only; save **toast** named in Add sheet with no pattern (DESIGN.md Components; EXPERIENCE.md Component Patterns → Add sheet). *Fix:* Pair each, or one line “inherits Nuxt UI `UButton`/`UAlert`/`UToast` with no brand delta.”
- **medium** **Featured Event** is a brand-layer component in both bodies but has no YAML `components.featured-event` token (DESIGN.md frontmatter `components` vs Components → Featured Event). *Fix:* Add a token block (or state it is Event group + `{typography.display-sm}` only).
- **medium** Names are not identical: Stat count vs Home stats; Attendance chips vs Attendance chip; Glass nav vs Glass nav Add (DESIGN.md Components; EXPERIENCE.md Component Patterns; YAML keys `stat-count`, `glass-nav`). *Fix:* One canonical name per component, used in YAML, DESIGN, and EXPERIENCE.

## 4. State coverage — thin

IA surfaces: Sign in / Register, Home, Concerts, Event, Add Concert, Edit Concert, Profile, Shared List. States present: cold load (Home, Concerts, Event); empties (Home upcoming, Concerts, Event Bill, Shared List); sharing-off/unknown; invalid save; duplicate warning; delete Event confirm; `going`→`attended`; visitor-as-someone-else; offline toast; agent-created indistinguishable.

### Findings

- **high** Unsigned visitor on an Event link must sign in before joining (SPEC Constraints; PRD FR-18). No state on Sign in or Event (EXPERIENCE.md State Patterns; Information Architecture). *Fix:* Event-link entry: redirect/sign-in, then Bill; unknown link = same quiet not-found as Shared List (no enumeration).
- **high** Joiner Event states are missing: Bill visible, Attendance editable, add/edit/delete/move blocked, other Users’ notes/Attendance hidden (sources CAP-7 / FR-18; EXPERIENCE.md State Patterns — Event rows are owner-shaped). *Fix:* Permission-denied treatments on write controls (hide, don’t tease) and a joiner cold-load/empty-Bill row.
- **medium** Sign in / Register has no invalid-credentials, duplicate-email, or submitting state (EXPERIENCE.md State Patterns vs IA → Sign in / Register). *Fix:* Named-rule errors; stay on the form.
- **medium** Profile has no cold-load, fetch error, or copy-link failure; Home / Concerts / Event / Shared List have no fetch-error; Shared List has no cold-load (EXPERIENCE.md State Patterns). *Fix:* Skeleton + named failure per fetch surface; Profile copy failure toast.
- **low** NFR ~1,000 Concerts (paginate/window, no infinite scroll) has no loading-more / truncated-list state (EXPERIENCE.md Interaction Primitives; State Patterns). *Fix:* One Concerts row: window or page, keep chrome-safe padding.

## 5. Visual reference coverage — thin

Files: `imports/tidal-home-frosted-chrome.png` (present). `mockups/` and `wireframes/` do not exist (Fast path skipped creative tools; Finalize did not add key-screen mocks).

### Findings

- **medium** The Tidal file is linked in DESIGN.md Brand & Style as the named reference; EXPERIENCE.md Inspiration cites `imports/` without the filename and does not point at it from chrome/nav (the thing the screenshot illustrates) (DESIGN.md Brand & Style; EXPERIENCE.md Inspiration & Anti-patterns; Elevation lives in DESIGN.md). *Fix:* Inline `imports/tidal-home-frosted-chrome.png` at glass nav / Elevation and name: dark Accueil title, frosted bottom chrome, active-item pill — not the “Pour vous” feed.
- **medium** No LiveMemory composition mock of Home (featured + stats), Concerts groups, Event Bill, or the hero frosted Add sheet (workspace `mockups/` / `wireframes/` absent; DESIGN.md Components → Add sheet). *Fix:* At least one HTML mock of Add sheet over an Event, or an explicit spine-only log that architecture may not invent layout.
- **low** Spines-win-on-conflict is stated once in EXPERIENCE.md as “any **future** mock,” not beside the existing import; DESIGN.md never states it (EXPERIENCE.md opening; DESIGN.md Brand & Style). *Fix:* One sentence in both files: spines win on conflict with `imports/` and any mock.

## 6. Bloat & overspecification — adequate

DESIGN.md editorial voice is appropriate. EXPERIENCE.md is mostly tables. Fast-path `[ASSUMPTION]` tags are load-bearing, not decoration.

### Findings

- **medium** Attendance & Bill restates SPEC/PRD grouping, Shared List omit rules, and Home composition already in IA (EXPERIENCE.md Attendance & Bill; Information Architecture). *Fix:* Keep only UX deltas (featured vs Concerts split, bill-only not on owner lists). Point at the spec for the rest.
- **low** Interaction Primitives opens with DESIGN-like narrative (“not a dead modal”); Assumptions Index repeats in-body `[ASSUMPTION]` tags (EXPERIENCE.md Interaction Primitives; Assumptions Index). *Fix:* Imperative bullets only; one assumption list.

## 7. Inheritance discipline — thin

`sources` files exist: SPEC.md and prd.md from repo root. `entities.md` is a SPEC companion, not listed. EXPERIENCE token refs `{components.glass-nav}`, `{components.add-sheet}`, `{components.attendance-going}`, `{typography.display-sm}`, `{colors.canvas}`, `{colors.primary}` resolve to DESIGN.md. Glossary nouns Event / Concert / Bill / Attendance / Shared List match. Product UI “Going” is assumption-tagged against PRD.

### Findings

- **critical** Add sheet says prefill is “per FR-14”. PRD **FR-14** is Shared List private-by-default. Prefill is **FR-7** (EXPERIENCE.md Component Patterns → Add sheet; prd.md FR-7 / FR-14). *Fix:* Cite FR-7 (and FR-12 for locked constraints). Downstream will implement the wrong requirement if they follow the citation.
- **high** Key Flows and IA never use verbatim **UJ-1…UJ-5** or **CAP-*** names (EXPERIENCE.md Key Flows vs prd.md §3.3). *Fix:* Headings like `### Flow 1 — UJ-2. Pierre sets up a single-night Event, then the Bill`.
- **high** Opening glossary omits **Event link**, **Event owner**, **Place**, **Stage or Scene**; Event link never appears as a noun in either spine (EXPERIENCE.md opening vs entities.md / prd.md Glossary). *Fix:* Same glossary list as entities.md; Event link in IA + components.
- **high** PRD FR-4 testable copy for `going` is **"J'y vais"**; spine Voice and Tone commits English **"Going"** and says spec/PRD win on product rules (EXPERIENCE.md Foundation / Voice and Tone vs prd.md FR-4). *Fix:* Resolve in PRD or UX: either English-only with an explicit PRD override, or bilingual label. Do not leave ASSUMPTION vs final PRD.
- **medium** `entities.md` is not in either `sources:` list (SPEC.md `companions`; DESIGN.md / EXPERIENCE.md frontmatter). *Fix:* Add `_bmad-output/specs/spec-livememory/entities.md`.
- **medium** Source paths mix repo-root (`_bmad-output/...`) and workspace-relative (`DESIGN.md`, `imports/tidal-home-frosted-chrome.png`) (both spines’ frontmatter). *Fix:* One resolution root; peer DESIGN.md as a documented sibling, not a `sources` path a repo-root crawler will miss.

## 8. Shape fit — strong

DESIGN.md body order: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts (all present, order-locked). EXPERIENCE.md defaults: Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows. Triggered: Inspiration (Tidal/Spotify/liquid glass + rejects), Responsive (phone + desktop). Invented Attendance & Bill and Assumptions Index earn Fast-path/product-nouns; they do not replace missing Event-link IA.

### Findings

- None that change extractability. `status: draft` on both files is noted under Mechanical notes.

## Mechanical notes

- Both spines `status: draft` / `updated: 2026-08-17`. Not a closed Finalize contract.
- No Mermaid.
- `{name}` and `{username}` in Accessibility Floor are copy templates, not DESIGN tokens — fine if not parsed as `{path.to.token}`.
- `[ASSUMPTION: set --ui-radius: 0.75rem` (12px = `{rounded.md}`)] cannot also make Event groups `{rounded.lg}` (16px). Consumers need a per-component radius, not one global.
- DESIGN.md lists `UModal` / `USlideover` “as-is” and then specifies a custom glass Add sheet — say Add sheet **is** a restyled `USlideover` (or not).
- Memlog still contains a superseded assumption (landing Upcoming; stats on Profile). Spines match later Home/Concerts decisions; do not implement the stale memlog line.
- EXPERIENCE.md `sources` includes `DESIGN.md`; DESIGN.md `sources` includes the Tidal PNG. Neither path resolves if a consumer prefixes only the repo root.
- Component YAML keys use kebab-case (`glass-nav`, `event-group`); prose uses title case. Map once.
- No broken `{path.to.token}` against DESIGN.yaml. Unused: `{spacing.gutter}`, `{spacing.section}`.
- Fast path + Reviewer Gate ran without promoting mocks; treat visual gaps as contract debt, not an unknown folder.
