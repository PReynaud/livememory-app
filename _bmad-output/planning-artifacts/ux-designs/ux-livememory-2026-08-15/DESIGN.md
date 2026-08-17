---
name: LiveMemory
description: Dark, high-contrast personal concert log in the streaming-app family.
status: final
sources:
  - _bmad-output/specs/spec-livememory/SPEC.md
  - _bmad-output/specs/spec-livememory/entities.md
  - _bmad-output/planning-artifacts/prds/prd-livememory-2026-08-17/prd.md
  - imports/tidal-home-frosted-chrome.png
updated: 2026-08-17
colors:
  # Brand-layer deltas on Nuxt UI 4. Unlisted semantic tokens inherit Nuxt UI defaults.
  canvas: '#000000'
  surface-card: '#1A1A1A'
  surface-glass: '#141414'
  foreground: '#FFFFFF'
  muted: '#A3A3A3'
  primary: '#FF4D8A'
  primary-foreground: '#000000'
  going: '#FF4D8A'
  going-foreground: '#000000'
  attended: '#A3A3A3'
  bill-only: '#A3A3A3'
  destructive: '#F87171'
typography:
  display:
    fontFamily: inherit
    fontSize: 34px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-sm:
    fontFamily: inherit
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.01em
  title:
    fontFamily: inherit
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.3'
  body:
    fontFamily: inherit
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.4'
  meta:
    fontFamily: inherit
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.35'
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  page-x: 16px
  page-x-md: 24px
  list-gap: 10px
  chrome-safe: 88px
components:
  glass-nav:
    background: '{colors.surface-glass}'
    foreground: '{colors.foreground}'
    radius: '{rounded.xl}'
    blur: 24px
    active: '{colors.going}'
  event-group:
    background: '{colors.surface-card}'
    foreground: '{colors.foreground}'
    radius: '{rounded.lg}'
  event-compact:
    background: '{colors.surface-card}'
    foreground: '{colors.foreground}'
    radius: '{rounded.lg}'
  concert-row:
    background: transparent
    foreground: '{colors.foreground}'
    meta: '{colors.muted}'
  attendance-going:
    background: transparent
    foreground: '{colors.going}'
    radius: '{rounded.full}'
  attendance-attended:
    background: transparent
    foreground: '{colors.attended}'
    radius: '{rounded.full}'
  attendance-unset:
    background: transparent
    foreground: '{colors.bill-only}'
    radius: '{rounded.full}'
  button-primary:
    background: transparent
    foreground: '{colors.going}'
    radius: '{rounded.full}'
  choice-chip:
    background: rgba(10, 10, 10, 0.88)
    foreground: '{colors.foreground}'
    radius: '{rounded.md}'
  choice-chip-selected:
    background: '{colors.going}'
    foreground: '{colors.going-foreground}'
    radius: '{rounded.md}'
  add-sheet:
    background: '{colors.surface-glass}'
    foreground: '{colors.foreground}'
    radius: '{rounded.xl}'
    blur: 28px
  featured-event:
    background: '{colors.surface-card}'
    foreground: '{colors.foreground}'
    radius: '{rounded.lg}'
  stats-block:
    background: '{colors.surface-card}'
    foreground: '{colors.foreground}'
    radius: '{rounded.lg}'
  stat-count:
    foreground: '{colors.foreground}'
    meta: '{colors.muted}'
---

## Brand & Style

LiveMemory is a private concert history that should feel like a music product, not a spreadsheet and not a social network. The visual family is the dark streaming home: Tidal as the named reference (`imports/tidal-home-frosted-chrome.png` — Accueil title, frosted bottom chrome, active-item pill; **not** the “Pour vous” feed), Spotify as a nearby cousin, Apple liquid glass as the reason the bottom chrome is translucent rather than a solid slab. Spines win on conflict with this import and any mock.

It inherits **Nuxt UI 4** (Tailwind v4 utilities, semantic `primary` / `neutral` / text / background tokens). This file specifies only the brand-layer delta. Do not introduce a second component library, icon set, or CSS methodology.

The posture: true-black canvas, white type that scans in one glance, slightly lifted cards, frosted chrome at the thumb. Generous title type on list surfaces; dense but not cramped rows underneath. No album art in v1 (product non-goal), so contrast and type do the work art would do in Tidal.

**Locked brand chroma (Pierre, 2026-08-17):** one hue `{colors.going}` (`#FF4D8A`) as **sparse touches**, not a second identity. Most of the UI stays black / white / muted. Pink appears only in the four roles under Colors → Going. Never a rainbow of badge colors, never Spotify/template green, never white primary pills.

v1 is **dark-only**. Force `.dark` on the app shell. No light theme.

Visual references (spines win on conflict): `imports/tidal-home-frosted-chrome.png` (frosted chrome family), `mockups/key-home.html`, `mockups/key-concerts.html`, `mockups/key-event.html`, `mockups/key-add-sheet.html`.

## Colors

- **Canvas (`{colors.canvas}`)** — Page background. Near-true black, darker than default Nuxt UI `--ui-bg` in dark mode. Maps to `--ui-bg: #000000` in `.dark`.
- **Surface card (`{colors.surface-card}`)** — Event groups on the canvas. A step up from canvas so groups read without borders. Maps toward `--ui-bg-elevated` / `--ui-bg-muted`, shifted toward `#1A1A1A`. Not used as the Add overlay fill.
- **Surface glass (`{colors.surface-glass}`)** — Fill *before* blur for bottom chrome **and** the Add/Edit Concert sheet. Never an opaque slab. Always paired with backdrop blur; the list or Event behind must remain faintly visible.
- **Foreground (`{colors.foreground}`)** — Titles, artist names, primary numbers. `--ui-text-highlighted` / white.
- **Muted (`{colors.muted}`)** — Place, date, secondary lines. `--ui-text-muted`.
- **Primary (`{colors.primary}`)** — Same hex as `{colors.going}`. Maps to Nuxt UI `--ui-primary` (factory green is **out**). **Not** a filled button fill. Outline CTAs use this for border + label; `{colors.primary-foreground}` (black) is for **filled selected** surfaces only. Primary **buttons** use the outline variant.
- **Going (`{colors.going}`)** — The **one** chroma, **global and locked**. Distinguish by **role + scale + glow**, never a second hue:
  1. **Selected choice (filled)** — Active nav icon pill and selected day-chip: `{colors.going}` fill + `{colors.going-foreground}` black glyph/type. Day-chip is the full filled chip. Active nav: filled icon pill, black icon; the word stays going so it reads on glass. Not a button, not a badge. No glow.
  2. **Primary action (large outline)** — Save, Add to this festival / this night, Attend this night, Copy link. Hollow: transparent fill, **2px** going border, going text, height **44px**, full-width or flex-grow in an action row. **No neon glow.** Lives in an action row / Event content footer. This is a button.
  3. **Going badge (small neon)** — Trailing 24px pill, **1px** border, going text, restrained glow. Status, not a CTA.
  4. **Quiet chips** — Confirmed `Attended`: 24px **solid** muted outline, no glow. **Unset ghost:** same 24px pill, muted ink, **dashed** outline, the **next-state word** (`Going` if upcoming, `Attended` if past), no glow. Not a third label.
  Add (+) in the nav stays a **white** filled circle — launcher, not selected, not a CTA duplicate. `#FF4D8A` on canvas ≈ 6.7:1 (outline text); black on `#FF4D8A` ≈ 6.7:1 (selected fill). On `{colors.surface-card}` outline ≈ 5.5:1.
- **Attended (`{colors.attended}`)** — Past Attendance. Quiet. Same hex as muted; quieter because it is outline/meta, not a filled chip.
- **Bill-only / unset (`{colors.bill-only}`)** — Outline ink for **unset** Attendance (this User has not marked going or attended). Same hex as `{colors.muted}`. Ghost pill `{components.attendance-unset}`: same geometry as Going/Attended, **dashed** muted border, **no glow**. Visible word is the next state — **Going** (upcoming) or **Attended** (past). Tap confirms that state. Distinct from neon Going (color + glow) and from confirmed Attended (solid muted outline). Never "Set", "On the bill", "Skipped", "Not going", +/−, or a third chroma. Never on the Shared List.
- **Destructive (`{colors.destructive}`)** — Delete Event confirmation and hard errors only. Inherit Nuxt UI error; hex is a dark-mode readable red, not a brand accent.

Load-bearing contrast (WCAG 2.2 AA, dark-only):

| Pair | Ratio (approx) | Use |
|---|---|---|
| `{colors.foreground}` on `{colors.canvas}` | 21:1 | titles, artist |
| `{colors.muted}` on `{colors.canvas}` | ≥ 7:1 | date, Place |
| `{colors.bill-only}` on `{colors.surface-card}` | ≥ 7:1 | unset ghost Going / Attended |
| `{colors.going}` on `{colors.canvas}` | ≈ 6.7:1 | Going badge, outline CTA, nav word |
| `{colors.going}` on `{colors.surface-card}` | ≈ 5.5:1 | Going badge / outline CTA on cards |
| `{colors.going-foreground}` on `{colors.going}` | ≈ 6.7:1 | selected day-chip; active nav icon |
| `{colors.destructive}` on `{colors.canvas}` | ≥ 4.5:1 | confirm delete / Leave |

Avoid: extra accent hues besides `{colors.going}`, gradients on the canvas, colored Event cards, using error red for Attendance.

## Typography

Inherit Nuxt UI / `@nuxt/fonts` sans for body, labels, and controls. Do not add a display serif.

- **`{typography.display}`** — Surface titles: Home, Concerts, Event name, Profile. One per screen, like Tidal "Accueil".
- **`{typography.display-sm}`** — Empty-state headlines, featured Event names, and Home stat numbers.
- **`{typography.title}`** — Event name on a **multi-concert** group; artist on a Concert row **and** on a compact 1-concert card.
- **`{typography.body}`** — Form fields, notes, confirmation copy.
- **`{typography.meta}`** — Date, Place, Stage or Scene, time.

Artist name is the loudest text on a Concert row. Place and date are `{typography.meta}` in `{colors.muted}`.

## Layout & Spacing

Nuxt UI / Tailwind spacing scale inherited. Product deltas:

- Horizontal page inset `{spacing.page-x}` (16px) on small viewports; `{spacing.page-x-md}` from `md` up.
- Event groups and compact Event cards stack with `{spacing.list-gap}`.
- Multi-concert bills group Concert rows **by day**. Same-day rows share spacing only — **no** hairline between siblings. The hairline sits **above the next day header** (after the last row of the previous day). First day under the Event hero or group header: no extra divider.
- Mobile list surfaces reserve `{spacing.chrome-safe}` at the bottom so rows are not trapped under the glass nav.
- Max content width on desktop: `max-w-3xl` for lists and Event; Profile may be narrower. This is a log, not a dashboard table.
- Home and Concerts are single-column. Desktop does not gain a second content column; it gains a persistent side nav. Home is Featured upcoming → stats only — not a continuation of the log.

## Elevation & Depth

Depth comes from **blur and fill**, not drop shadows.

- Canvas is flat black.
- Cards are a lighter fill, no shadow.
- **Exception — Going chip:** a restrained `box-shadow` glow in `{colors.going}` (≈ `0 0 8px` at 40% alpha). Chip-only. Not card elevation. Reduced motion: drop the glow; keep the outline.
- Glass nav: `backdrop-filter: blur({components.glass-nav.blur})` plus translucent `{colors.surface-glass}`. Content scrolling underneath must tint the bar (Tidal player/nav).
- **Add sheet is the same material, scaled up:** a panel that unfolds from the bottom in `{components.add-sheet}` (blur `{components.add-sheet.blur}`, fill `{colors.surface-glass}`, top corners `{rounded.xl}`). It is not an opaque card and not a fullscreen takeover. The Event or list behind stays visible through the glass — that is the point.
- Inputs inside the sheet sit on a slightly more opaque well (still on-canvas family) so type meets AA when a busy list bleeds through. The chrome is glass; the fields are readable.
- Scrim behind the sheet is light. Do not black out the page.
- No global shadow scale. If Nuxt UI Button/Card shadows appear, neutralize them on list surfaces.

## Shapes

Rounder than Nuxt UI's default `--ui-radius: 0.25rem`. Set `--ui-radius: 0.75rem` so cards and fields follow `{rounded.md}` / `{rounded.lg}`.

- Event groups: `{rounded.lg}`
- Concert add sheet: `{rounded.xl}` on the top corners (mobile bottom sheet)
- Primary buttons and Attendance `going` chip: `{rounded.full}` (pill)
- Active glass-nav item: pill, as in the Tidal home icon
- Inputs: `{rounded.md}`

## Components

Use Nuxt UI components as-is unless listed: `UButton`, `UForm` / fields, `UCard` (restyled to `{colors.surface-card}`), `UModal` / `USlideover`, `UAlert`, `UBadge`, `UNavigationMenu`, `USkeleton`, `UEmpty`.

Brand-layer components:

- **Glass nav** — Mobile (`< lg`) persistent bottom bar. Frosted Tidal-family chrome — do **not** neon-glow the bar. Four targets: **Home**, Concerts, Add, Profile. Add is a white filled launcher pill. **Active** is selected-choice: icon pill **filled** `{colors.going}`, black glyph; label `{colors.going}`. Not an outline button, not a Going badge. Inactive items stay white. Desktop left rail uses the same selected fill on the active icon. → `mockups/key-home.html`
- **Event group** — `{components.event-group}` on Concerts, Shared List, and the Event bill card. Used when the Bill has **2+ Concerts**. Header: Event name, date or range, Place. Body: Concert rows grouped by day. Day headers (`{typography.meta}`, semibold) are the visual breaks — not row hairlines. Tapping the header opens Event view. → `mockups/key-concerts.html`, `mockups/key-event.html`
- **Compact Event** — `{components.event-compact}` when the Bill has **exactly one Concert** (typical `single_night`; also a festival or named night that still has one act). Same fill/radius as Event group. **One** artist title (`{typography.title}`), not Event name then artist again. One meta line: date · Place · time · Stage or Scene if present. If Event name ≠ artist, Event name is a **second muted meta line**, not a second title. Attendance chip on the right. Still an Event — tap opens Event view. Empty Bills (0 Concerts) stay a header-only Event group, not compact. → `mockups/key-concerts.html`
- **Featured Event** — Home only, above stats. `{components.featured-event}`: same fill/radius as Event group. **2+ Concerts:** Event name `{typography.display-sm}`, then day-grouped rows (same day-break rule as Event group). **1 Concert:** artist as `{typography.display-sm}` (compact anatomy, larger type). Tapping still opens Event. Home stops after stats. → `mockups/key-home.html`
- **Event picker** — Inside Add sheet. Visual: list of owned Event names on glass; two explicit create rows (**New night**, **New festival**) below search, `{typography.title}`, not buried toggles. Inherits field wells of Add sheet. No separate YAML token — Add sheet chrome.
- **Concert row** — Artist (`{typography.title}`), optional time, Stage or Scene, Attendance control for **this** User. Owner Event also shows unset rows as ghost chips. Joiner: chips only, no edit affordance. Shared List never shows chips as controls.
- **Attendance chips** — `Going` is a **hollow neon** pill (`{components.attendance-going}`): transparent fill, `{colors.going}` border and pink label, restrained glow. Confirmed `Attended` is a quiet **solid** grey outline with the word Attended. **Unset** is `{components.attendance-unset}`: dashed muted outline, no glow, **same word as the next state** (Going if upcoming, Attended if past). Never "Set", a radio-hole circle, or +/−. Never fill the Going attendance chip (that fill is for selected choice chips).
- **Add sheet** — The hero glass piece, not a dialog. Unfolds from the bottom on every breakpoint (full-bleed on `< lg`; centered, max-width ~28rem on `lg+`). Grab handle, frosted body, artist field focused. Fields use a slightly more opaque inner well. Outline **Save**, then **Add another** stays in the sheet. Festival **day chips** (`{components.choice-chip}`): unselected stay dark; **selected** is `{components.choice-chip-selected}` — filled going + black weekday and date (selected choice, not a CTA). Idle chips (Place is a field, not a chip in v1) stay uncolored. Edit Concert (owner) uses the same sheet. Restyled `USlideover`, not a second modal system. → `mockups/key-add-sheet.html`
- **Primary button** — Large **outline** CTA (`{components.button-primary}`): transparent fill, **2px** `{colors.going}` border, going label, 44px height, no glow. Used for Save, **Add to this festival** / **Add to this night**, Copy public-profile link, Attend this night. **Not** for Leave Event. Nuxt UI outline + primary, not solid. Distinct from the 24px / 1px / glow Going badge.
- **Add to this Event** — Owner Event, in the **content** under the Bill (not pinned over the glass nav). Same large outline primary. Copy is scoped: festival vs night. Distinct from nav **Add**, which starts a new Event/Concert flow.
- **Attend this night** — `{components.button-primary}` on `single_night` Event.
- **Leave Event** — Quiet text/ghost control on joiner Event. Destructive confirm uses `{colors.destructive}` for the confirm action only.
- **Sharing controls** — Profile. Inherit Nuxt UI toggle + ghost copy. No brand-layer fill.
- **Validation alert** — Inherit `UAlert`. Named-rule copy only.
- **Toast** — Inherit Nuxt UI toast after Add save. No brand delta.
- **Stats block** — Home, directly under featured upcoming. One `{components.stats-block}` card (same fill/radius as Event group), not three mini-cards and not naked numbers on the canvas. Inside: `{components.stat-count}` — large number + one-word label, three counts max, one horizontal row. Not tappable. Not charts. Not on Profile. → `mockups/key-home.html`

## Do's and Don'ts

| Do | Don't |
|---|---|
| Black canvas, white type, going as the only chroma — sparse touches, four roles | Keep template green, Spotify green, a second pink, or color every chip |
| Frost the bottom chrome **and** the Add sheet; let the list bleed through | Solid opaque footer, opaque add modal, or glass on every Event card |
| Make artist + Event name scannable in one glance | Hide the add path behind a desktop-only control |
| Same hue, four roles: filled select, large outline CTA, small neon Going, quiet chips | Fill Save, glow Save, or use the 24px Going pill as a button |
| Unset = dashed ghost of the next word (Going / Attended) | "Set", empty circle, "On the bill", +/−, or a third chroma badge |
| Compact a 1-concert Event to one artist title | Repeat Event name as a group header when it is the only artist |
| Break festival bills on day headers | Hairlines between same-day Concert rows |
| One stats card under featured Home | Naked stats on the canvas, or a card per number |
| Inherit Nuxt UI for forms, alerts, focus rings | New CSS methodology, extra icon pack, or custom kit |
| Dark-only v1 | Ship a light theme "for completeness" |
| Event URL as the join link; quiet copy if needed | Share sheet, invite modal, or a second “secret link” chrome |
| Empty album-art slots | Implied photos or cover images (v1 non-goal) |
