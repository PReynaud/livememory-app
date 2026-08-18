---
name: LiveMemory
status: final
sources:
  - _bmad-output/specs/spec-livememory/SPEC.md
  - _bmad-output/specs/spec-livememory/entities.md
  - _bmad-output/planning-artifacts/prds/prd-livememory-2026-08-17/prd.md
updated: 2026-08-18
---

# LiveMemory — Experience Spine

Product nouns follow `entities.md`: **Event**, **Event owner**, **Event link**, **Concert**, **Bill**, **Attendance**, **Shared List**, **Home**, **Concerts**. A **joiner** is a signed-in User who opened an Event link and is not the Event owner. Visual tokens live in sibling `DESIGN.md` (`{path.to.token}`). Spines win on conflict with `imports/` and any mock. Spec/PRD win on product rules. Leave Event is in the PRD.

## Foundation

Responsive **web**, phone and desktop at equal importance. Not a native app, not a PWA. Concert **add must be clearly easier on a phone** (thumb reach, prefill, stay-in-flow for the next artist).

UI system: **Nuxt UI 4** on Nuxt 4. Behavioral delta only; do not restyle the library except where `DESIGN.md` names a brand-layer component. `DESIGN.md` is the visual identity (dark streaming family, frosted chrome, **one locked chroma** `{colors.going}` in four roles).

Product UI language: **English**. On-screen Attendance label is **"Going"**. PRD token `going` / "J'y vais" is the glossary synonym only — this spine overrides FR-4 testable copy for the English UI.

Auth is individual accounts. Two share paths: **Shared List** (public profile; visitors may be signed out; tap an Event to open it and join) and **Event link** (unguessable Event URL; joiners must be signed in; own Attendance only). MCP is not a screen; agent-created rows must look identical to UI-created rows.

## Information Architecture

| Surface | Reached from | Purpose | Who |
|---|---|---|---|
| Sign in / Register | Marketing/login URL; Event-link redirect | Email + password + unique username (FR-1). Default land: Home. Event-link: return to that Event after sign-in | Anyone |
| Home | Glass nav / side nav | Accueil: featured upcoming Events (owned **and** joined), then nostalgic stats. Not the full log. | Signed-in User |
| Concerts | Glass nav / side nav | Full Event list: owned and joined, upcoming then past. **2+ Concerts:** Event group. **1 Concert:** compact card (artist once). | Signed-in User |
| Event (owner) | Group header; Concert row; Event URL while owner | Full Bill, own Attendance, **Add to this festival** / **Add to this night**, soirée attend-all, edit/delete Event. The page URL **is** the Event link (FR-18). No share-sheet product. | Event owner |
| Event (joiner) | Event link after sign-in; Concerts row; Shared List tap | Same Event details and Bill Concerts. Own Attendance only (soirée attend-all for self; festival per Concert). No Add-to-this-Event, no Edit Concert, no Edit/Delete Event. **Leave Event**. | Joiner |
| Add Concert | Nav **Add** (new Event/Concert); owner Event scoped CTA | Create a Concert on an Event the User **owns**. From Event: that Event is prefilled. From nav: picker or transparent single-night. Never writes a joined Bill. | Event owner |
| Edit Concert | Concert row (owner) | Update fields, Attendance, notes, move Event | Event owner |
| Profile | Glass nav / side nav | Username, sharing on/off + copy public-profile URL, sign out | Signed-in User |
| Shared List | Username-derived public URL | Same chrome, that User's `going` + `attended`. Tap a grouping to open the Event (sign-in then join, FR-18). No write on this page. | Visitor |

Default signed-in landing is **Home**. The rest of the log lives on **Concerts**, not under the Home stats.

Home composition (top → bottom):

1. **Featured upcoming** — next Events, larger treatment (desire / planning).
2. **Stats** — three counts in **one** `{components.stats-block}` card, souvenirs, not a dashboard. Not tappable.

Home **does not** continue with the remaining upcoming Events. Those appear on Concerts with everything else.

→ Composition reference: `mockups/key-home.html`, `mockups/key-concerts.html`, `mockups/key-event.html`, `mockups/key-add-sheet.html`. Spines win on conflict.

Featured block shows the next 1–3 upcoming Events by start date, including joined Events. Concerts lists owned and joined Events grouped, upcoming then past. Empty future Events the User owns appear on Concerts; they also appear in Home featured if among the next 1–3.

Surfaces that are **not** v1: dedicated rapid-add festival page, running-order scanner, analytics dashboard, searchable user directory, light-theme settings.

**Nav (mobile `< lg`):** frosted bottom `{components.glass-nav}` — Home · Concerts · **Add** · Profile. Active tab is **selected choice**: filled going icon pill, black glyph; label `{colors.going}`. Add opens the Add Concert sheet for a **new** Event/Concert flow; it is not a fifth list and stays a white launcher (not the outline CTA).

**Nav (desktop `lg+`):** persistent left rail, same four targets and the same filled-icon selected state, no frost required. Content column `max-w-3xl`.

Modal stack: one level. Add sheet may sit on Event; never a dialog on a dialog.

## Mock coverage

| Surface | Visual | Built from |
|---|---|---|
| Home | `mockups/key-home.html` | Mock + spine |
| Concerts | `mockups/key-concerts.html` | Mock + spine |
| Event (owner, festival) | `mockups/key-event.html` | Mock + spine |
| Add Concert sheet | `mockups/key-add-sheet.html` | Mock + spine |
| Edit Concert | — | Same sheet as Add (spine) |
| Sign in / Register | — | Spine-only |
| Profile | — | Spine-only |
| Shared List | — | Spine-only |
| Event (joiner) | — | Spine-only (owner Event mock minus write controls + Leave Event) |

Pierre accepted spine-only for Sign in, Profile, Shared List, and joiner Event at Finalize.

HTML mocks are visual comps. Implement Attendance chips as `<button>` with accessible names from Component Patterns; do not copy `<span>` markup from mocks. Spines win on conflict.

## Voice and Tone

Microcopy. Brand posture is in `DESIGN.md`.

| Do | Don't |
|---|---|
| "Add to this festival" / "Add to this night" (owner Event, scoped to this Bill) | Generic "Add concert" on Event; a second nav-style "Add" |
| "Add" (glass nav only — new Event / Concert flow) | Nav Add meaning "add to this Bill" |
| "Add concert" | "Create a new concert record" |
| "Going" / "Attended" (unset uses the next-state word, dashed) | "Set", "On the bill", "Skipped", "Not going", "RSVP" |
| "Attend this night" (soirée shortcut, owner or joiner — **their** Attendance) | Festival-wide "I'm going to all acts" |
| "Leave Event" (joiner) | "Unsubscribe from this lineup" |
| "This date is outside the Event." | "Validation error E_DATE_RANGE" |
| "Nothing upcoming. Add a night." | "You have 0 items. Get started! 🎉" |
| Named rule in the message (dates, Stage or Scene, required, ownership) | Generic "Something went wrong" on Event rules |

Notes field placeholder: "Private. Never on your public profile."

## Component Patterns

Behavioral. Visual specs: `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Event group | Concerts, Shared List, Event bill | **2+ Concerts.** Header opens Event (on Shared List that is the join path). Body lists Concerts by day. Same-day rows: spacing only, **no** hairline. Hairline **above the next day header**. First day under the header: no extra divider. Do not also list those Concerts as standalone rows. |
| Compact Event | Concerts, Shared List, Home featured when Bill has 1 Concert | Artist once (`{typography.title}`; `{typography.display-sm}` on Home featured). Meta: date · Place · time · Stage if any. If Event name ≠ artist, Event name is a second muted line. Chip on the right (not on Shared List). Whole card opens Event. Empty Bills stay a header-only Event group. |
| Featured Event | Home, top | Next 1–3 upcoming Events, larger than a group. **2+ Concerts:** Event name + day-grouped rows (same day-break rule). **1 Concert:** compact anatomy, artist as the featured title. Same tap → Event. Not a "for you" feed. Not followed by the rest of the log. |
| Concert row | Event, multi-concert groups | Owner: tap row → Edit Concert. Attendance chip cycles **that User's** `going` ↔ clear (future) or `attended` ↔ clear (past). Joiner: chip only — no edit, no notes. Shared List visitor: no chips that look like controls; tap the grouping/card to open Event. |
| Add sheet | Add Concert, Edit Concert (owner) | Bottom-anchored **glass** panel (`{components.add-sheet}`). Partial height: the Event or list remains visible through the frost. Field order: **Artist** (focused) → Event (picker or "New night") → date → Place → optional time, Stage or Scene, notes. From an owned Event: date/Place/Event locked-prefilled per **FR-7**; festival still asks for **day**. Festival day chips: unselected stay dark; **selected** is filled `{colors.going}` + black label (`{components.choice-chip-selected}`) — selected choice, not a CTA. Place is a field in v1, not a chip. After save: toast + **Add another** with the same Event prefill. Dismiss: swipe down, tap scrim, or Esc. Virtual keyboard docks the sheet above it. Picker lists **owned** Events only. |
| Event picker | Add sheet | Search **owned** Events; "New night" collects name, date, Place and creates `single_night`. "New festival" is a second explicit choice in the picker, not a toggle buried in settings. Joined Events do not appear. |
| Attend this night | Event (`single_night` only) | Owner **or** joiner. One-shot: sets **that User's** Attendance on Concerts currently on the Bill (`going` before Europe/Paris boundary, `attended` after). Concerts added later start unset. Hidden on `festival` — per Concert only. |
| Attendance chip | Owner and joiner Event, lists | Confirmed `Going` hollow neon. Confirmed `Attended` solid muted outline. **Unset:** dashed muted ghost of the **next state** — visible **Going** if upcoming, **Attended** if past (`{components.attendance-unset}`). Tap confirms that state. Accessible name "Mark as going" / "Mark as attended". Never "Set", "On the bill", Skipped, +/−, or a third chroma. Never shows another User's Attendance. Shared List: confirmed Going/Attended only (hides ghosts). |
| Glass nav | Mobile `< lg` | Four targets: Home, Concerts, Add, Profile. Frosted `{components.glass-nav}`. Active = selected choice (filled going icon pill). Add is the white launcher: opens Add sheet for a **new** Event/Concert flow (picker). Never adds a Concert to a joined Event. Hit target ≥ 44px. Not a fifth list. |
| Primary button | Save; Add to this Event; Attend this night; Copy public-profile link | Large outline `{components.button-primary}` only. Never the Going badge geometry. Never Leave Event. |
| Stats block | Home under featured | One `{components.stats-block}` card wrapping the three `{components.stat-count}` values. Not tappable. |
| Toast | After Add save; copy failure | Inherit Nuxt UI toast. No brand-layer chrome. |
| Add to this Event | Event (owner) | Large outline `{components.button-primary}` (2px going border, going text, 44px, no glow). Label is **Add to this festival** (`festival`) or **Add to this night** (`single_night`) — never generic "Add concert", never the single word "Add". Lives in Event content under the Bill, not pinned on the glass nav. Opens Add sheet with this Event prefilled (FR-7). Hidden for joiners. Distinct from the 24px neon Going badge. |
| Leave Event | Event (joiner) | Quiet control, not `{components.button-primary}`. Confirm. Event leaves the joiner's Home and Concerts. Owner Bill unchanged. Rejoin = open the Event URL again while signed in. |
| Event link | Event (owner) page URL | The Event URL **is** the unguessable link (FR-18). Giving that URL is the share. Optional quiet copy; **no** share sheet, invite modal, or directory. Public-profile off does not disable it. |
| Stat count | Home, inside `{components.stats-block}` under featured | Three numbers: all-time attended Concerts, all-time Events (owned + joined), current going Concerts. One card, one horizontal row. Not tappable, not charts, not year-over-year, not duplicated on Profile. |
| Sharing controls | Profile | Toggle enables username URL. Copy link. Helper: "Friends see Going and Attended. They can open an Event to join — they never edit your bill or see notes." |
| Validation alert | Forms | `UAlert` names the failed rule and, on Event updates, lists affected Concerts. Concert identity (FR-13): timed match attaches (navigate to existing); different Place is a named refuse; missing time asks attach vs create. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold load | Home, Concerts, Event, Shared List | `USkeleton` matching featured + stats (Home) or groups (Concerts). |
| Sign in invalid | Sign in | Named error: "Email or password is wrong." Stay on the form. |
| Register duplicate | Register | Named error: "This email already has an account." Stay on the form. |
| Submitting | Sign in / Register | Primary button busy; no double submit. |
| Copy failed | Profile | Toast: "Couldn't copy the link." |
| Fetch error | Home, Concerts, Event, Shared List | Named failure: "Couldn't load." Retry. |
| Empty upcoming on Home | Home | Featured empty: `{typography.display-sm}` "Nothing upcoming." Stats still show (zeros allowed). Body: "Add a night or a concert." Primary: Add concert. No substitute list of past Events on Home. |
| Empty Concerts | Concerts | "No shows yet." Same primary. |
| Long Concerts list | Concerts, Shared List | Window or paginate to hit the 1,000-Concert NFR. No infinite scroll. Muted "Loading more" row at the list end while the next page fetches. |
| Empty Event Bill | Event (owner) | "No concerts on this bill." Primary: **Add to this festival** / **Add to this night** (prefilled). |
| Empty Event Bill | Event (joiner) | "No concerts on this bill." No Add CTA. |
| Unsigned Event link | Event URL | Redirect to Sign in. After success, open that Event as joiner (or as owner if it is theirs). |
| Unknown Event link | Event URL | Not found. Same quiet empty as unknown Shared List — no enumeration. |
| Joiner Event | Event | Bill visible. Attendance chips for **this** User only. Add / Edit Concert / Edit Event / Delete Event **hidden**, not disabled. Owner notes and Attendance not shown. |
| Leave Event | Event (joiner) | Confirm: "Leave this Event? It will leave your list. The bill stays for the owner." After leave, Concerts without that Event. |
| Empty Shared List | Shared List | If sharing on but nothing visible: "Nothing to show yet." No add CTA. |
| Sharing off / unknown user | Shared List URL | Not found. Same quiet empty as unknown slug — do not say "this user exists but is private." |
| Invalid save | Add / Edit | Inline + named rule. Stay in the sheet. |
| Concert identity | Add / Edit | Timed match: navigate to the existing Concert (draft not saved as a second row). Impossible Place: named refuse, stay in the sheet. Missing time: choose attach or create; cancel keeps the draft. |
| Delete Event | Event | Confirm: Event **and** all Concerts are deleted. No keep-standalone. |
| `going` becomes `attended` | Home / Concerts / Event | After Europe/Paris past, the Concert leaves Home featured (if it was there) and sits with past Events on Concerts. No interstitial "How was it?" |
| Visitor signed in as someone else | Shared List | Read-only. No edit chrome. |
| Offline | Global | v1 shows a toast and blocks writes; no offline queue. |
| Agent-created data | All owner lists | Indistinguishable from typed rows. |

## Interaction Primitives

**Mobile-first add.** Thumb: Add in glass nav → a frosted panel unfolds from the bottom (same material as the nav, larger). Artist keyboard open. Save and Add another without returning to the list. The night behind the glass is still there — context for prefill, not a dead modal.

**Prefill.** Adding from Event never re-asks what the Event already knows (`single_night`: date + Place; `festival`: Place + day picker in range + Stage or Scene if the list exists).

**Multi-artist night.** One flow, several steps: stay on the Add sheet with the same Event. Not a spreadsheet paste, not the later running-order scan.

**Banned in v1:** hover-only actions on `< md`, drag-and-drop line-up, infinite scroll (lists paginate or window if needed to hit the 1,000-Concert NFR), modal stacks deeper than one, a separate "skip" Attendance value, public search of users.

**Desktop extras (not required on mobile):** `n` opens the same bottom glass sheet (centered, not a right drawer). `Esc` closes it. No vim-style command palette in v1.

**Touch:** Multi-concert: Event group header vs Concert row are separate hit targets. Compact Event: the whole card opens Event; chip tap still cycles Attendance and does not open Edit. Chip tap never accidentally opens Edit.

## Accessibility Floor

Behavioral. Contrast lives in `DESIGN.md` (white on black; muted must still meet AA on `{colors.canvas}`).

- WCAG 2.2 AA on the responsive web surface.
- Focus rings inherit Nuxt UI; keep them visible on black.
- Glass nav is `nav`; Add is a `button` with accessible name "Add concert".
- Screen reader: surface name on route change ("Home", "Concerts", "Event: {name}", "Profile", "Shared list for {username}"). Joiner Event announces without edit actions.
- Attendance chips expose state in visible text (`Going`, `Attended`). Unset uses the same word as the next state, dashed; accessible name **"Mark as going"** or **"Mark as attended"**.
- Reduced motion: drop blur animation; static translucent bar is OK. Sheets fade instead of spring. Drop the Going chip glow; keep the outline.
- Shared List does not announce missing notes or bill-only Concerts.

## Inspiration & Anti-patterns

- **Lifted from Tidal (named, screenshot in `imports/`):** dark canvas, large surface title, scannable cards, frosted bottom chrome, pill on the active nav item, information readable at a glance.
- **Lifted from Spotify:** same family; confirmation that a music product should sit here — not a reason to copy green or the home feed.
- **Lifted from Apple liquid glass:** translucent chrome, not skeuomorphic widgets on every row.
- **Rejected — discovery feeds, staff picks, "for you":** LiveMemory is Pierre's nights, not a recommender. Event join is a URL you send, not a people directory.
- **Rejected — analytics dashboard:** Home may show three nostalgic counts under featured upcoming. No charts, funnels, or KPI tiles.
- **Rejected — festival poster / album art as required UI:** v1 has no media. Do not leave empty squares "for later covers."
- **Rejected — opaque tab bars, light-first SaaS chrome, spreadsheet density as the default list.**

## Responsive & Platform

| Breakpoint | Behavior |
|---|---|
| `< lg` | Bottom `{components.glass-nav}`. Add sheet is a bottom sheet. Event title `{typography.display-sm}` if long. Chrome-safe padding on lists. |
| `≥ lg` | Left rail, no bottom glass. Add sheet/panel. Same Event group anatomy. |

Phone and desktop are both first-class for **reading**. **Writing a Concert** is optimized for phone: fewer fields visible, prefill, Add another. Desktop may show notes and Stage or Scene without unfolding.

## Attendance & Bill (product-specific)

- One shared Event record. Only the **Event owner** edits the Bill. Joiners set **their** Attendance (FR-18).
- Event view shows the Bill. The Event owner sees their Attendance and notes. Joiners see only their Attendance (no notes field). Unset Concerts show a dashed ghost of the next state (Going / Attended), not "Set" or "On the bill".
- **Attend this night** is `single_night` only (owner or joiner, self), one-shot on current Concerts. Festival = per Concert.
- **Leave Event** is a joiner action (FR-18): confirm; drop from Home and Concerts; Bill unchanged; URL to rejoin.
- Home featured includes joined upcoming Events. Concerts lists owned + joined.
- Shared List is a public profile. Tap an Event to open it and join (FR-18). The Shared List page itself has no write. After join, the visitor sees the full Bill.

## Key Flows

### Flow 1 — UJ-1. Pierre logs a one-performer show (transparent Event)

1. Pierre is signed in on his phone (FR-1 already done). **Home**. He hits **Add**.
2. Add sheet: artist focused. He does **not** pick an Event. He enters artist, date, Place.
3. Save transparently creates a `single_night` Event he owns, with that Concert. Past date → Attendance `attended`.
4. **Climax:** **Concerts** shows one **compact Event** card with that artist once — not Event name then the same artist again. Same data model as Event-first create.

Failure: missing artist/date/Place → named required-field alert, sheet stays open.

### Flow 2 — UJ-2. Pierre, phone, after a soirée (add the whole bill)

1. Pierre opens LiveMemory on his phone. **Home** shows featured upcoming (or the empty upcoming line) and stats underneath; he hits **Add**.
2. Add sheet: artist focused. He chooses **New night**, names it, date and Place once.
3. He types the first artist, saves. The sheet stays; Event is prefilled. He adds the next artists the same way.
4. On Event, he hits **Attend this night** — past date, every Concert becomes `attended`.
5. **Climax:** **Concerts** now shows one Event group with every artist of that night. He did not create standalone Concerts and did not retype Place.

Failure: date/Place missing on New night → named required-field alert, sheet stays open.

### Flow 3 — UJ-3. Pierre plans a festival

1. Days before, on a laptop, he creates a `festival` Event (range, Place, optional Stage or Scene list). It appears featured on Home if it is among the next nights.
2. He opens Event and browses as he adds the Bill — by day, artists, optional times. The list is meant to make him want to go, not to score him.
3. He marks only the Concerts he will see as `Going`. No attend-all.
4. **Climax:** Opening that Event on his phone the morning of day two, he sees the day's Bill with neon Going vs dashed next-state ghosts at a glance, and can still **Add to this festival** with day + Place prefilled.

Failure: Concert date outside the range → "This date is outside the Event." plus the Event's range. Save blocked.

### Flow 4 — UJ-4. Sam, Shared List (small group)

1. Pierre enabled sharing on Profile and texted Sam the username URL.
2. Sam opens it signed out. Same dark app chrome, no glass Add, no edit.
3. He sees Pierre's `going` and `attended` grouped by Event. No notes. No bill-only rows. He taps an Event.
4. **Climax:** Sign-in if needed, then the Event: full Bill, his own Attendance. He cannot edit the Bill.

Failure: sharing off or unknown username → not-found empty, no account enumeration copy.

### Flow 5 — UJ-5. Sam joins Pierre's festival via Event link

1. Pierre is on his festival Event. He sends Sam the page URL (the Event link). Public profile can stay off.
2. Sam is signed out. Opening the URL sends him to **Sign in**. After sign-in he lands on that Event.
3. He sees the full Bill (all artists, including ones he will not mark). No Add, no edit. Pierre's notes and Attendance are hidden. He marks some Concerts `Going`. No attend-all (festival).
4. **Climax:** The Event is on Sam's **Concerts** (and Home featured if it is soon). His Attendance is his. Pierre still owns the Bill.
5. Later he hits **Leave Event**, confirms. The Event leaves his lists. Pierre's Bill is unchanged. Sam needs the URL again to return.

Failure: unknown Event URL → same quiet not-found as Shared List. Joiner tries to add a Concert → control is not there.

FR-1 first-run (register → Home → first Concert under 3 minutes) is Flow 1 after Sign in / Register.

## Locked notes

- Dark-only; landing **Home** (featured upcoming including joined → one stats card); full log on **Concerts** (compact when 1 Concert, Event group when 2+); English "Going" as hollow neon outline; three Home counts as specified.
- New festival is an explicit picker choice. Add sheet never writes a joined Bill.
- Empty future **owned** Events show on Concerts, and on Home featured when they are among the next 1–3.
- Event URL is the Event link; no share-sheet product.
- Leave Event is a joiner action (FR-18).
- Shared List groupings open the Event (join path).
- Register collects username (FR-1).
- v1 no offline write queue.
- Desktop: left rail; mobile: glass nav. Frost is required on mobile chrome.
- Factory green is out (**locked**). `{colors.primary}` is `{colors.going}`. Primary buttons are **large outline** (2px, 44px, no glow). Going attendance is **small neon** (1px, 24px, glow). Selected choice is **filled**. Add (+) stays white. Sparse touches only — never a second accent hue.
