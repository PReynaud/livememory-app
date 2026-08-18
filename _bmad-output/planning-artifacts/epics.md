---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-livememory-2026-08-17/prd.md
  - _bmad-output/planning-artifacts/prds/prd-livememory-2026-08-17/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-livememory-2026-08-17/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/reconcile-tidal.md
  - _bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/mockups/key-home.html
  - _bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/mockups/key-concerts.html
  - _bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/mockups/key-event.html
  - _bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/mockups/key-add-sheet.html
  - _bmad-output/specs/spec-livememory/SPEC.md
  - _bmad-output/specs/spec-livememory/entities.md
  - docs/project-context.md
---

# LiveMemory - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for LiveMemory, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: A User can register with email, password, and a unique username (`a-z`, `0-9`, `_`, `-`; case-insensitive unique; collision copy "This username is taken"), then sign in and sign out. Username is immutable in v1. After register and sign-in the User lands on Home. Sign-out returns an unauthenticated state; Home and Concerts are not shown. Shared List cannot be enabled without a username (v1 always has one from registration).

FR-2: An Event owner can create, view, update, and delete Concerts on that Event. A Concert requires artist or group, date, and exactly one Event; time is optional; future dates are allowed. Adding a Concert without selecting an Event transparently creates a `single_night` Event named `Concerts on {DD/MM/YYYY} at {Place}` (Europe/Paris calendar date + entered Place); the owner can rename it. Joiners cannot create, update, or delete Concerts. Delete removes the Concert from the Bill for every User, plus every User's Attendance and owner notes. When any non-owner has joined, Concert delete requires confirmation naming joiner impact. Deleting the last Concert leaves the Event empty (owner may then delete it via FR-11). Transparent and Event-first create produce the same fields, rules, and Concerts appearance.

FR-3: The Event owner can attach optional notes to a Concert. Joiners have no notes field and cannot create, update, or delete notes. Notes never appear on a Shared List or on another User's Event view.

FR-4: Attendance is per User on a Concert: `going` (shipped label "Going"), `attended`, or unset (Bill-only). No skipped value. A User can clear only their Attendance; the Concert stays on the Event. Stored `going` that is past in Europe/Paris (after optional clock time, else end of that Paris calendar day) becomes `attended` without a further click. Owner default `going`/`attended` applies only to transparent one-Concert create (FR-2 / UJ-1). Concerts added onto an existing Event start unset for everyone. Other Users always start unset. Past Concerts: `attended` or unset (`going` stores as `attended`). Future Concerts: `going` or unset (`attended` is rejected). `attended` cannot become `going`. Clear at the past boundary stays unset. One User's Attendance is never shown on another User's Event view.

FR-5: The Event owner can create and update an Event as `single_night` or `festival`, with name, date or inclusive Europe/Paris date range, Place, optional Stage/Scene list, and per-Concert Place-override policy (defaults off). An Event may have zero Concerts and is listed on Concerts (and Home featured if among the next 1–3 upcoming owned or joined). Single-night uses the same start and end date. Empty Stage/Scene list means a Stage/Scene is not required. An update that would invalidate existing Concerts is blocked and lists affected Concerts and failed rules, unless the owner saves Event dates and Concert dates together (FR-12). Joiners cannot update Event fields.

FR-6: The Event owner can add Concerts to an Event and move a Concert from one Event they own to another they own without duplicating. A move is blocked when the target Event's dates, Place policy, or Stage/Scene list reject the Concert. The Concert always belongs to exactly one Event. Per-User Attendance and notes stay on that Concert id. Source joiners who are not joiners of the target are not auto-joined and lose the Concert from their Bill view; when any non-owner has joined the source, the owner confirms the move. Moving the last Concert leaves the source Event empty.

FR-7: Adding a Concert from an Event prefills Event defaults. From `single_night`: date and Place prefilled; User mainly enters artist or group. From `festival`: Place prefilled; User still chooses the day in range, artist or group, and Stage/Scene when that list exists. The new Concert belongs to that Event without a second record.

FR-8: After sign-in the User lands on Home. Home shows the next 1–3 upcoming Events the User owns or has joined, then a souvenir stats block: all-time `attended` Concerts, all-time Events (owned + joined), current `going` Concerts. Stats are not tappable and are not a dashboard. Home does not list the rest of the log. Concerts lists owned Events (including empty) and joined Events (including joined Events with no Attendance for that User), upcoming then past, each Event grouping once. A `festival` Event on Concerts or Event view groups Concerts by date inside the Event range.

FR-9: The Event view shows every Concert on that Event's Bill and the acting User's Attendance value, if any. Concerts with no Attendance for the acting User still appear. Another User's Attendance and notes are not shown.

FR-10: On a `single_night` Event, a User can mark Attendance on every Concert currently on that Bill in one action (`going` before the Europe/Paris boundary, `attended` after). Concerts added later start unset. There is no persistent flag. No equivalent shortcut on a `festival` Event. The User can afterwards clear Attendance on an individual Concert.

FR-11: Deleting a non-empty Event is Event-owner-only and requires explicit confirmation that the Event and all its Concerts will be deleted for every joiner (Attendance and owner notes deleted with Concerts). Empty Event delete is owner-only without the Concert warning; joiners stop seeing it; the Event link becomes unknown. A joiner cannot delete the Event. No Concert survives without an Event.

FR-12: A Concert cannot be saved or moved outside its Event dates, on a disallowed Stage/Scene, or with a conflicting Place when override is off. Event start and end dates are inclusive Europe/Paris calendar dates. A defined Stage/Scene list restricts selection to those names. Event Place is inherited by default. Incompatible Event updates are blocked and list every affected Concert. The Event owner can change Event dates and Concert dates in one save so a range correction cannot deadlock.

FR-13: Validation copy names the failed rule (dates, Stage/Scene, required fields, ownership, or Concert identity). Concert identity is the Event owner's journal, not a worldwide catalog. Same owner, artist (case-insensitive), date, and clock time: no new row; return the existing Concert (attach) without moving it. Event and Stage/Scene are not part of that identity key: a timed match on another owned Event still attaches (does not reparent); the same timed match on a different Stage/Scene still attaches. Same owner, artist, date, and time at a different effective Place: create is refused. Same owner, artist, and date with time missing on one or both sides: User (and MCP) must choose attach (may then set time on the existing Concert) or create a second Concert. Same artist and date with different times: create is allowed without that choice.

FR-14: A User's Shared List is off until they enable it. With the public profile off, the username URL is not visible. Event links still work (FR-18).

FR-15: The owner can expose a Shared List at a URL derived from their unique username or turn it off. There is no searchable User directory. Enabled Shared List is reachable without signing in. A disabled profile or unknown username is not visible (same visitor result).

FR-16: Visitors browse Events and Concerts with Attendance `going` or `attended` on the Shared List. No edit or write controls on that page (including when signed in as someone else). Notes and Concerts with no Attendance are omitted. Events with no visible Concerts do not appear. Tapping a grouping opens that Event URL (FR-18); viewing the Shared List does not by itself join. After join, the visitor sees the full Bill and can set only their Attendance. Concerts on Events the profile User does not own may appear when that User has `going` or `attended` on them.

FR-17: An authenticated agent can list, read, create, update, move, and delete Events and Concerts, including Attendance, subject to the same Event-owner vs joiner rights, validation, Concert-identity (FR-13), and deletion rules as the UI. Agent-created Concerts are indistinguishable in the UI. A joiner's agent cannot edit the Bill. An unauthenticated caller cannot write. v1 ships MCP after the first UI CRUD path works; both are in MVP. Screenshot interpretation stays outside LiveMemory.

FR-18: The Event page URL is the unguessable Event link. A signed-in User who opens it can view the Bill and set only their Attendance (including one-shot single-night attend-all for themselves). Unsigned visitors must sign in first and then return to that Event and join. Joiners cannot add, edit, move, or delete Concerts, update or delete the Event, or write notes. Other Users' Attendance and owner notes are not visible. The Event appears on the joiner's Concerts after they open the link while signed in, and on Home featured if among their next 1–3 upcoming. A joiner can leave: the Event leaves their Home and Concerts and their Attendance on its Concerts is deleted; the Bill is unchanged. Re-opening an already-joined link is view, not a second join. An unknown Event link is not visible. Public-profile off does not disable Event links. Shared List groupings for visible Events navigate to this Event URL. No Event search, link rotation, owner kick, or joiner roster in v1. The link stays valid until the Event is deleted.

### NonFunctional Requirements

NFR-1: Privacy — public profile is off until enabled; notes are Event-owner-only; Attendance is per User and never appears on another User's Event view or Shared List; Shared List visitors do not write on the profile page; individual accounts only.

NFR-2: Platform — responsive web at `https://livememory.pierre-reynaud.fr`; phone and desktop at equal importance for reading; Concert add must be clearly easier on a phone. No PWA / installable app in v1.

NFR-3: Safety — Shared List visitors must not gain write access on the profile page; Event-link joiners must not edit the Bill; agents write only within the acting User's rights.

NFR-4: Performance — lists of about 1,000 Concerts remain usable; the complete list loads within 2 seconds under normal use. Lists paginate or window; no infinite scroll.

NFR-5: Validation — copy names the failed rule (dates, Stage/Scene, required fields, ownership, or Concert identity). Event updates that fail list affected Concerts.

NFR-6: Write-path parity — UI and MCP writes enforce the same Event, Attendance, membership, Concert-identity, and deletion rules.

NFR-7: Factory stack is binding — Nuxt 4, Nuxt UI, Pinia for remote data, SQL migrations with RLS, no Prisma, no PWA. Playwright targets local Supabase only. Every story adds or updates tests. Stay on factory carets; `@nuxtjs/supabase` exact `2.0.9`. Auto-imports stay off.

NFR-8: Shipped UI copy is English. Attendance `going` label is "Going" (glossary synonym "J'y vais" is not UI copy).

NFR-9: Usability first-run — a new User can register (including username), sign in, land on Home, and add a first Event-backed Concert in under 3 minutes (SM-1).

NFR-10: Accessibility — WCAG 2.2 AA on the responsive web surface; visible Nuxt UI focus rings on black; glass nav is `nav`; Add is a `button` named "Add concert"; route changes announce surface names; Attendance chips expose state in visible text with accessible names "Mark as going" / "Mark as attended"; reduced motion drops blur animation and Going-chip glow.

NFR-11: Dark-only v1 — force `.dark` on the app shell; no light theme.

NFR-12: No realtime fan-out in v1 — refresh on revisit. List queries are set-based for the signed-in User (owned+joined), not per-Event round trips.

NFR-13: Offline — v1 shows a toast and blocks writes; no offline queue.

NFR-14: Environments — production is Vercel + one hosted Supabase. Schema changes are migrations only; commit `app/types/database.types.ts` from `pnpm db:types`. CI `build:vercel` must set `NUXT_PUBLIC_SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_KEY`. E2E against local Supabase only; never point Playwright at remote. Hosted schema is applied from `supabase/migrations`.

NFR-15: Postgres is the last word on who may read or write — hard product rules (ownership, membership, dates vs Concerts, stage list, username unique, timed Concert unique, past/future Attendance, one Event per Concert) are enforced in the database. Domain turns failures into SPEC-shaped English messages. `service_role` is forbidden for Event/Concert/Attendance/membership/stage reads and writes.

### Additional Requirements

**Starter / greenfield:** LiveMemory v1 is built on the **existing Nuxt/Supabase factory** in this repo (`nuxt-app-template` lineage). Do not copy the old LiveMemory codebase. Epic 1 Story 1 extends this factory (schema, auth, domain seed), not a new starter.

- **AD-1 Shared domain, Postgres kernel:** One isomorphic TypeScript domain module in `shared/domain` takes a user-scoped Supabase client (JWT so RLS applies). Pinia stores, MCP tools, and pages must not query domain tables (`events`, `concerts`, `attendance`, `event_members`, `event_stages`, personal keys, or views over them) except Shared List may SELECT only the kernel public view (AD-2). SQL RPC is not the default. Nitro `server/api` exists only for personal-key exchange (AD-4) and registration (AD-6); after minting a user-scoped client it calls the domain module. Pages call stores; they do not fetch remote domain data.

- **AD-2 Two readers:** Unauthenticated SELECT is allowed only through the kernel public Shared List view (enabled profiles; effective `going`/`attended`; grouped by Event; no notes; no unset Attendance; no empty Events). Notes are Event-owner SELECT only. Nobody SELECTs another User's Attendance. Disabled profile and unknown username are the same not-found result; enabled-but-empty is a visible empty list. Event pages require a signed-in owner or member. Auth redirect excludes `/`, `/login`, `/confirm`, `/u/**`. Auth middleware on `/home`, `/concerts`, `/profile`, `/e/:id`. After `/confirm`, honor `redirect` to an Event URL; otherwise land on Home.

- **AD-3 Effective Attendance on read:** No background job and no persist-on-read. Effective Attendance is defined once in SQL (view or function). UI, MCP, and Shared List read that definition — never the raw column for display. Writes must not store `going` on a past Concert.

- **AD-4 MCP personal key:** The User creates and revokes a personal key in the app. MCP sends the key to a Nitro route that verifies a hash, mints a user-scoped client, and runs the domain module as that User. Store hashes, never plaintext. v1 is revoke-only (no expiry). Screenshot interpretation stays outside LiveMemory. Bind SDK choice when CAP-6 is built (after UI CRUD).

- **AD-5 Opaque Event URL:** Event page path is `/e/:id` where `:id` is the Event UUID. That URL is the unguessable Event link. Renaming does not change it. No vanity slugs in v1.

- **AD-6 Username is the only label:** One human identifier `profiles.username`, chosen at registration with email and password in one step. It is the Shared List path `/u/:username` and the name shown in the UI. Replace factory `display_name`. Extend factory `handle_new_user` to write `username` from signup metadata; keep `EXECUTE` revoked on security-definer functions. Unique index is the backstop. E2E account helpers must supply a username. Nitro signup only if the trigger path cannot be atomic.

- **AD-7 Civil Paris time, UUID ids:** Event `start_date`/`end_date` are calendar dates (inclusive). Concert has a calendar date plus optional clock time. Values are civil Europe/Paris, stored as date/time-without-timezone, not UTC-as-source-of-truth. Place is free text. All entity ids are UUIDs.

- **AD-8 Membership is not Attendance:** `events.owner_id` is the Event owner. Joiners have `event_members (event_id, user_id)`. Join inserts that row; leave deletes that row and that User's Attendance on that Event's Concerts. A member may have zero Attendance rows. Opening an Event URL after sign-in calls join. Owner is not stored in the members table.

- **AD-9 Stages are rows:** `event_stages` (UUID + name) belong to one Event. Concert references `stage_id`, not a name string. Empty list means a stage is not required. Rename does not detach Concerts.

- **AD-10 Concert identity on create:** Domain create returns exactly one of `created`, `attached`, `needs_choice`, `impossible_place`. Move between Events is a separate owner operation. Database unique-guards timed exact matches; the untimed case cannot be only a unique index.

- **AD-11 Kernel and copy:** Hard rules in the database. Domain returns structured results including identity outcomes and errors with rule id + message. Attendance unset is no row; `going`/`attended` is one row per User per Concert. Stores keep `{ data, error }`.

- **AD-12 Event kind, transparent create, attend-all:** Event `kind` is `single_night` or `festival`. Transparent one-Concert create makes a `single_night` Event with SPEC name template and sets owner Attendance by the Paris boundary. That default does not apply when adding further Concerts. Attend-all is a one-shot domain action per User on Concerts currently on that `single_night` Bill.

- **AD-13 Event and Concert dates save together:** An Event edit that would invalidate existing Concerts is blocked and lists those Concerts, unless the owner saves Event dates and Concert dates in one domain operation.

- **AD-14 Environments and types:** As NFR-14. Hosted schema from migrations, not ad-hoc SQL. Backups and ops: hosted Supabase defaults; no second cloud.

- **Routes:** `/` marketing; `/login` `/confirm`; `/home`; `/concerts`; `/profile`; `/e/:id`; `/u/:username`.

- **Tables:** `profiles`, `events`, `concerts`, `event_stages`, `event_members`, `attendance`, personal-key table.

- **Structural seed:** `app/pages`, `app/stores`, `app/components`, `shared/domain`, `server/api` (personal key + signup only), `supabase/migrations`, `tests/unit`, `tests/e2e`.

- **Capability map for sequencing:** CAP-1 account + owner CRUD; CAP-2 Events as groups / Home vs Concerts; CAP-3 dates, place, stages; CAP-4 Shared List; CAP-5 Attendance / attend-all; CAP-6 MCP after UI CRUD; CAP-7 join / leave / Bill view.

- **Deferred (do not story in v1):** pretty Event slugs; SQL RPC as default mutation style; extra preview/staging product; realtime; username rename; Event-link rotation; owner kick; joiner roster; joiner notes; concert duration/overlap windows; import from old LiveMemory; OAuth for MCP; PWA.

### UX Design Requirements

UX-DR1: Apply DESIGN brand tokens on Nuxt UI 4 — canvas `#000000`, surface-card `#1A1A1A`, surface-glass `#141414`, foreground `#FFFFFF`, muted `#A3A3A3`, primary/going `#FF4D8A` with going-foreground `#000000`, attended and bill-only `#A3A3A3`, destructive `#F87171`. Map canvas to `--ui-bg` in `.dark`. Replace factory green: `{colors.primary}` is `{colors.going}`. Unlisted semantic tokens inherit Nuxt UI defaults. Do not add a second component library, icon set, or CSS methodology.

UX-DR2: Locked chroma roles — `{colors.going}` appears only as (1) selected-choice fill (active nav icon pill, selected day-chip: going fill + black glyph/type, no glow), (2) large outline primary CTA (2px going border, going text, 44px height, no glow), (3) small neon Going badge (24px, 1px border, restrained glow), (4) quiet chips (confirmed Attended solid muted outline; unset dashed ghost). Sparse touches only. Never a second accent hue, never fill Save, never glow Save, never use the 24px Going pill as a button. Add (+) in nav stays a white filled circle.

UX-DR3: Typography tokens — `{typography.display}` 34px/700 for one surface title per screen (Home, Concerts, Event name, Profile); `{typography.display-sm}` 24px/700 for empty-state headlines, featured Event names, and Home stat numbers; `{typography.title}` 16px/600 for Event name on multi-concert groups and artist on Concert rows and compact cards; `{typography.body}` 15px/400 for forms/notes; `{typography.meta}` 13px/400 for date, Place, Stage/Scene, time. Inherit Nuxt UI sans; no display serif. Artist is the loudest text on a Concert row.

UX-DR4: Layout tokens — page-x 16px (24px from `md`); list-gap 10px; chrome-safe 88px bottom padding on mobile lists; `--ui-radius: 0.75rem`; Event groups `{rounded.lg}`; Add sheet top corners `{rounded.xl}`; primary buttons and Going chip `{rounded.full}`; inputs `{rounded.md}`. Max content width `max-w-3xl` for lists and Event. Home and Concerts are single-column; desktop does not gain a second content column.

UX-DR5: Elevation — depth from blur and fill, not drop shadows. Cards: lighter fill, no shadow. Glass nav: `backdrop-filter: blur(24px)` plus translucent surface-glass; content scrolling underneath must tint the bar. Add sheet: blur 28px, surface-glass, light scrim (do not black out the page); fields sit on a slightly more opaque inner well. Going chip glow ≈ `0 0 8px` at 40% alpha, chip-only; reduced motion drops glow and keeps outline. Neutralize Nuxt UI Button/Card shadows on list surfaces.

UX-DR6: Glass nav component — mobile `< lg`: persistent frosted bottom bar, four targets Home · Concerts · Add · Profile. Active = selected-choice (filled going icon pill, black glyph; label going). Add is a white launcher opening the new Event/Concert Add sheet (not add-to-this-Bill). Hit target ≥ 44px. Desktop `lg+`: persistent left rail, same four targets and filled-icon selected state, frost not required. Accessible name for Add: "Add concert". Desktop shortcut `n` opens the same bottom glass sheet (centered, max-width ~28rem); `Esc` closes it. No vim command palette.

UX-DR7: Event group component — used on Concerts, Shared List, and Event bill when the Bill has 2+ Concerts. Header: Event name, date or range, Place; tapping header opens Event view (on Shared List that is the join path). Body: Concert rows grouped by day. Same-day rows: spacing only, no hairline. Hairline above the next day header. First day under the header: no extra divider. Empty Bills (0 Concerts) stay a header-only Event group, not compact.

UX-DR8: Compact Event component — when the Bill has exactly one Concert. One artist title (`{typography.title}`; `{typography.display-sm}` on Home featured). One meta line: date · Place · time · Stage/Scene if present. If Event name ≠ artist, Event name is a second muted meta line, not a second title. Attendance chip on the right (not on Shared List). Whole card opens Event view. Compact Event chip tap cycles Attendance and does not open Edit.

UX-DR9: Featured Event component — Home only, above stats. Next 1–3 upcoming owned+joined Events by start date. 2+ Concerts: Event name `{typography.display-sm}` then day-grouped rows. 1 Concert: compact anatomy with artist as featured title. Tapping opens Event. Home does not continue with the rest of the log.

UX-DR10: Stats block component — one `{components.stats-block}` card under featured Home wrapping three `{components.stat-count}` values in one horizontal row: all-time attended Concerts, all-time Events (owned + joined), current going Concerts. Not tappable, not charts, not on Profile, not three mini-cards.

UX-DR11: Concert row component — artist (`{typography.title}`), optional time, Stage/Scene, Attendance control for this User. Owner: tap row → Edit Concert. Joiner: chips only, no edit affordance. Shared List visitor: no chips that look like controls; tap grouping/card to open Event. Multi-concert: Event group header vs Concert row are separate hit targets.

UX-DR12: Attendance chips — confirmed Going: hollow neon pill (transparent fill, going border and label, restrained glow). Confirmed Attended: solid muted outline, word "Attended". Unset: dashed muted ghost of the next state (visible "Going" if upcoming, "Attended" if past); tap confirms that state; accessible name "Mark as going" / "Mark as attended". Never "Set", "On the bill", "Skipped", "Not going", RSVP, +/−, empty circle, or a third chroma. Never shows another User's Attendance. Shared List shows confirmed Going/Attended only (hides ghosts). Implement as `<button>`, not mock `<span>` markup.

UX-DR13: Add sheet component — restyled `USlideover` glass panel unfolding from the bottom on every breakpoint (full-bleed `< lg`; centered ~28rem on `lg+`). Grab handle, frosted body, artist field focused. Field order: Artist → Event (picker or "New night") → date → Place → optional time, Stage/Scene, notes. From an owned Event: date/Place/Event locked-prefilled per FR-7; festival still asks for day. After save: toast + "Add another" with the same Event prefill. Dismiss: swipe down, tap scrim, or Esc. Virtual keyboard docks the sheet above it. Edit Concert (owner) uses the same sheet. Add sheet never writes a joined Bill. Modal stack: one level.

UX-DR14: Event picker inside Add sheet — search owned Events only; two explicit create rows below search: "New night" (name, date, Place → `single_night`) and "New festival" (explicit second choice, not a buried toggle). Joined Events do not appear. Festival day chips: unselected stay dark; selected is filled going + black weekday and date (`{components.choice-chip-selected}`). Place is a field in v1, not a chip.

UX-DR15: Primary outline CTAs — large outline `{components.button-primary}` for Save, "Add to this festival" / "Add to this night", "Attend this night", and Copy public-profile link. Owner Event CTA lives in content under the Bill, not pinned on the glass nav. Hidden for joiners. Distinct from nav "Add" and from the 24px neon Going badge. Leave Event is a quiet text/ghost control, not a primary button.

UX-DR16: Named English microcopy — "Add to this festival" / "Add to this night"; nav "Add" only for new Event/Concert flow; "Add concert"; "Going" / "Attended"; "Attend this night"; "Leave Event"; "This date is outside the Event."; empty Home "Nothing upcoming. Add a night."; empty Concerts "No shows yet."; notes placeholder "Private. Never on your public profile."; sharing helper "Friends see Going and Attended. They can open an Event to join — they never edit your bill or see notes."; sign-in error "Email or password is wrong."; register duplicate "This email already has an account."; fetch error "Couldn't load." with Retry; copy failure toast "Couldn't copy the link."; leave confirm "Leave this Event? It will leave your list. The bill stays for the owner."; empty Shared List "Nothing to show yet."

UX-DR17: Empty, loading, and error states — Home/Concerts/Event/Shared List cold load uses `USkeleton` matching featured+stats or groups. Empty Home featured: display-sm "Nothing upcoming." Stats still show (zeros allowed); primary "Add concert"; no substitute list of past Events. Empty Concerts: "No shows yet." Empty owner Event Bill: "No concerts on this bill." plus scoped Add CTA. Empty joiner Event Bill: same message, no Add CTA. Empty enabled Shared List: "Nothing to show yet." no add CTA. Sharing off / unknown username / unknown Event link: same quiet not-found (do not enumerate). Fetch error: named "Couldn't load." + Retry. Invalid save: stay in the sheet with named-rule `UAlert`. Long lists: window or paginate with muted "Loading more" row; no infinite scroll.

UX-DR18: Auth and Event-link states — unsigned Event URL redirects to Sign in; after success open that Event as joiner (or owner if theirs). Register collects username in one step. Submitting Sign in/Register: primary button busy; no double submit. Joiner Event: Bill visible; Attendance chips for this User only; Add / Edit Concert / Edit Event / Delete Event hidden (not disabled); owner notes and Attendance not shown; Leave Event present. Concert identity UI: timed match navigates to existing Concert; impossible Place named refuse stays in sheet; missing time asks attach vs create; cancel keeps the draft.

UX-DR19: Delete and leave confirms — non-empty Event delete confirms Event and all Concerts are deleted (no keep-standalone). When joiners exist, copy names they lose the Event, Concerts, and their Attendance. Leave Event confirm as UX-DR16. After leave, Concerts without that Event.

UX-DR20: Profile sharing controls — inherit Nuxt UI toggle + ghost copy. Toggle enables username URL. Copy link uses primary outline CTA. No brand-layer fill. No share-sheet product, invite modal, or second secret-link chrome. Event URL on Event page is the join link; optional quiet copy only.

UX-DR21: Responsive breakpoints — `< lg`: bottom glass nav, Add as bottom sheet, Event title `{typography.display-sm}` if long, chrome-safe padding. `≥ lg`: left rail, same Event group anatomy, Add sheet centered. Writing a Concert is optimized for phone (fewer fields visible, prefill, Add another). Desktop may show notes and Stage/Scene without unfolding. Banned: hover-only actions on `< md`, drag-and-drop line-up, infinite scroll, modal stacks deeper than one.

UX-DR22: Contrast floor (WCAG 2.2 AA, dark-only) — foreground on canvas 21:1; muted on canvas ≥ 7:1; bill-only on surface-card ≥ 7:1; going on canvas ≈ 6.7:1; going on surface-card ≈ 5.5:1; going-foreground on going ≈ 6.7:1; destructive on canvas ≥ 4.5:1. Shared List does not announce missing notes or bill-only Concerts. Screen reader surface names: "Home", "Concerts", "Event: {name}", "Profile", "Shared list for {username}".

UX-DR23: Visual composition references — implement Home, Concerts, Event (owner festival), and Add sheet to match `mockups/key-home.html`, `key-concerts.html`, `key-event.html`, `key-add-sheet.html` where spines win on conflict. Tidal reconcile: keep dark canvas, large surface title, scannable cards, frosted bottom chrome, pill on active nav; drop “Pour vous” feed, album art, Tidal chroma, and player transport. Sign in, Profile, Shared List, and joiner Event are spine-only (no dedicated mock). No empty album-art slots.

UX-DR24: Auto-attended visual transition — after Europe/Paris past, a `going` Concert leaves Home featured (if it was there) and sits with past Events on Concerts. No interstitial "How was it?". Agent-created rows look identical to typed rows.

### FR Coverage Map

FR-1: Epic 1 - Account, unique username, session, land on Home
FR-2: Epic 1 - Owner Concert CRUD and transparent single-night Event (joiner-impact delete confirm completed in Epic 2)
FR-3: Epic 1 - Event-owner notes
FR-4: Epic 1 - Per-user Attendance, auto-attended, owner default on transparent create
FR-5: Epic 1 - Create and update Event (single_night and festival)
FR-6: Epic 1 - Move Concert without duplicating (joiner-impact move confirm completed in Epic 2)
FR-7: Epic 1 - Prefill Concert entry from Event
FR-8: Epic 1 - Home (featured + souvenir stats) vs Concerts (full log)
FR-9: Epic 1 - Event view is the Bill
FR-10: Epic 1 - Single-night attend-all one-shot
FR-11: Epic 1 - Delete Event (joiner-impact confirm completed in Epic 2)
FR-12: Epic 1 - Constrain Concerts by Event dates, Place, Stage/Scene
FR-13: Epic 1 - Named validation and Concert identity on create
FR-14: Epic 2 - Shared List off by default
FR-15: Epic 2 - Enable and disable username-derived public profile
FR-16: Epic 2 - Read-only visitors see going and attended; tap opens Event
FR-18: Epic 2 - Event link, join, own Attendance, leave; owner-only Bill
FR-17: Epic 3 - MCP machine interface with the same rules as the UI

## Epic List

### Epic 1: Keep a private log of nights
Pierre registers, signs in, and keeps a private Event-backed log: single-night shows and festivals, Concerts, per-user Attendance, owner notes, Home (featured + three souvenir stats), and Concerts (full owned log). LiveMemory is usable alone, with no sharing required.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13

### Epic 2: Share a night without giving the Bill away
Pierre sends an Event URL or enables a Shared List. Sam can view, join, set only his Attendance, and leave — never edit the Bill or see notes. Event links work with the public profile off. Joiner-impact confirms for Concert delete, Concert move, and Event delete land here once membership exists.
**FRs covered:** FR-14, FR-15, FR-16, FR-18

### Epic 3: Let an agent write the same log
Pierre creates and revokes a personal key. An authenticated agent can list, read, create, update, move, and delete Events and Concerts (including Attendance and joins) under the same owner vs joiner rights and validation as the UI. Not a second product.
**FRs covered:** FR-17

## Epic 1: Keep a private log of nights

Pierre registers, signs in, and keeps a private Event-backed log: single-night shows and festivals, Concerts, per-user Attendance, owner notes, Home (featured + three souvenir stats), and Concerts (full owned log). LiveMemory is usable alone, with no sharing required. Built on the existing Nuxt/Supabase factory. Every story adds or updates tests in `tests/unit` and/or `tests/e2e` (Playwright against local Supabase only). Pages call Pinia stores; stores call `shared/domain` with a user-scoped client.

### Story 1.1: Register with username and land on a branded Home

As a music fan,
I want to create an account with a unique username, sign in and out, and land on a dark Home with LiveMemory chrome,
So that I have a private place to start my log and nobody else can take my profile name.

**Acceptance Criteria:**

**Given** I am signed out on `/login`
**When** I register with email, password, and a username using only `a-z`, `0-9`, `_`, and `-`
**Then** an account is created, `profiles.username` is stored (factory `display_name` is replaced), and I land on `/home`
**And** the username is the label shown in the UI (AD-6, FR-1)

**Given** a username already exists with different capitalization
**When** I register with that same username
**Then** registration fails with "This username is taken"
**And** I stay on the form (UX-DR18)

**Given** I submit Sign in or Register
**When** the request is in flight
**Then** the primary button is busy and a second submit does not fire

**Given** Sign in credentials are wrong
**When** I submit
**Then** I see "Email or password is wrong." and stay on the form

**Given** the email already has an account
**When** I register
**Then** I see "This email already has an account." and stay on the form

**Given** I am signed in
**When** I open `/home`, `/concerts`, or `/profile`
**Then** those routes are reachable and use auth middleware
**And** UI copy is English
**And** the app shell is dark-only (`.dark`, `{colors.canvas}` `#000000`, `{colors.primary}` is `{colors.going}` `#FF4D8A`, factory green is gone) (UX-DR1, UX-DR2, NFR-8, NFR-11)

**Given** I am signed in on a viewport `< lg`
**When** I view any signed-in surface
**Then** a frosted glass nav shows Home, Concerts, Add, and Profile
**And** Home is the selected-choice state (filled going icon pill, black glyph, going label)
**And** Add is a white filled launcher with accessible name "Add concert" (opening the Add sheet is Story 1.3)
**And** on `lg+` the same four targets sit in a left rail (UX-DR6, UX-DR21)

**Given** Home has no upcoming Events yet
**When** I land after register or sign-in
**Then** I see surface title Home, empty featured copy "Nothing upcoming." and body "Add a night or a concert."
**And** a stats block may show zeros
**And** the rest of the log is not listed on Home (FR-8, UX-DR17)

**Given** Concerts has no Events yet
**When** I open Concerts
**Then** I see "No shows yet." and a primary "Add concert"
**And** Concerts is not shown when I am signed out

**Given** I am on Profile
**When** I view it
**Then** I see my username
**And** I can sign out
**And** there is no rename control; username is immutable in v1 (FR-1)
**And** sharing controls are not in this story (FR-15 is Epic 2)

**Given** I sign out
**When** the session ends
**Then** I am unauthenticated
**And** `/home` and `/concerts` are not shown (FR-1)

**Given** E2E helpers create an account
**When** they sign up
**Then** they supply a username
**And** `handle_new_user` writes `username` from signup metadata
**And** `EXECUTE` stays revoked on that security-definer function
**And** a unique index enforces case-insensitive username uniqueness (AD-6)

### Story 1.2: Create an Event and see it on Concerts

As an Event owner,
I want to create a single-night or festival Event (including with zero Concerts) and see it on Concerts at `/e/:id`,
So that I can name a night or festival before I know every artist.

**Acceptance Criteria:**

**Given** I am signed in
**When** I create a `festival` Event with name, inclusive Europe/Paris start and end dates, and Place
**Then** it is saved with a UUID id and path `/e/:id` (AD-5, AD-7, FR-5)
**And** renaming the Event does not change that URL

**Given** I create a `single_night` Event
**When** it is saved
**Then** start date and end date are the same calendar date (FR-5, AD-12)

**Given** I save an Event with zero Concerts
**When** I open Concerts
**Then** that Event is listed (upcoming then past by start date)
**And** an empty Bill is a header-only Event group, not a compact card (FR-8, UX-DR7)

**Given** I open `/e/:id` for an Event I own
**When** the Bill has zero Concerts
**Then** I see "No concerts on this bill."
**And** I do not yet persist Concerts in this story (FR-9, UX-DR17)

**Given** Event rows exist
**When** Pinia loads Concerts
**Then** pages do not query `events` directly; the domain module in `shared/domain` is used with a user-scoped client (AD-1)
**And** only the tables this story needs are added (`events`), with RLS so a User selects and mutates only Events they own
**And** `app/types/database.types.ts` is regenerated from `pnpm db:types` after the migration (AD-14, NFR-14)

**Given** I am signed out
**When** I request `/e/:id` or `/concerts`
**Then** I am sent to Sign in (Event-link join is Epic 2)

### Story 1.3: Add Concerts to an owned Event

As an Event owner,
I want to add Concerts onto an Event from a phone-friendly Add sheet with Event prefill,
So that I can file a whole bill without retyping Place and dates the Event already knows.

**Acceptance Criteria:**

**Given** I own a `single_night` Event
**When** I tap **Add to this night** under the Bill
**Then** the glass Add sheet opens with date and Place locked-prefilled
**And** I mainly enter artist or group (FR-7, UX-DR13, UX-DR15)

**Given** I own a `festival` Event with no Stage/Scene list
**When** I tap **Add to this festival**
**Then** Place is prefilled, I still choose the day inside the Event range, and Stage/Scene is not required (FR-7, FR-5)

**Given** I save a Concert with artist, date, and Event (optional time)
**When** the save succeeds
**Then** the Concert belongs to that Event's Bill and is visible on the Event view
**And** a future date and a missing time are allowed (FR-2, FR-9)
**And** a toast appears and **Add another** stays in the sheet with the same Event prefill (UX-DR13)

**Given** I open the Add sheet from nav Add
**When** I pick an Event I own
**Then** the picker lists owned Events only, with explicit **New night** and **New festival** rows (UX-DR14)
**And** Save is a large outline primary CTA (2px going border, 44px, no glow) (UX-DR2, UX-DR15)

**Given** a `festival` Event has Concerts on more than one day
**When** I view the Event or a multi-concert group
**Then** Concerts are grouped by date; same-day rows have no hairline; a hairline sits above the next day header (FR-8, UX-DR7, UX-DR11)

**Given** required fields are missing
**When** I save
**Then** a named required-field alert is shown and the sheet stays open (FR-13, UX-DR16)

**Given** Concerts are stored
**When** I sign out and sign in
**Then** the Concerts are still on that Event (FR-2)
**And** the `concerts` table (UUID, `event_id` not null, calendar date, optional time, inherited Place) is the only new table this story needs
**And** writes go through `shared/domain`, not pages or ad-hoc store queries (AD-1)

**Given** I am on `< lg`
**When** the Add sheet is open
**Then** it unfolds from the bottom, the Event or list remains visible through frost, artist is focused, and a light scrim does not black out the page (UX-DR5, UX-DR13)
**And** on `lg+` the same sheet is centered (~28rem)
**And** `n` opens it and `Esc` closes it (UX-DR6)

### Story 1.4: Enforce Concert identity on create

As an Event owner,
I want create to attach, refuse, or ask me to choose instead of silently duplicating,
So that my journal stays one Concert per identity in my own log.

**Acceptance Criteria:**

**Given** I already have a Concert with the same artist (case-insensitive), date, and clock time
**When** I create again with that identity
**Then** the domain returns `attached`, no new row is inserted, `event_id` does not change, and the UI navigates to the existing Concert (FR-13, AD-10)

**Given** that timed identity already exists on Event A that I own
**When** I create the same artist, date, and clock time under Event B that I also own
**Then** the domain returns `attached`, no new row is inserted, and `event_id` stays Event A (attach does not reparent)
**And** the UI navigates to the existing Concert on Event A and copy names that it already exists on another Event (FR-13, AD-10)

**Given** that timed identity already exists on one Stage/Scene
**When** I create the same owner, artist, date, and clock time on a different Stage/Scene
**Then** the domain returns `attached` to the existing row — Stage/Scene is not part of Concert identity (FR-13, AD-10)

**Given** that same timed identity at a different effective Place
**When** I create
**Then** the domain returns `impossible_place`, create is refused, a named message is shown, and I stay in the sheet

**Given** the same owner, artist, and date with time missing on one or both sides
**When** I save
**Then** the domain returns `needs_choice`
**And** I must choose attach (may then set time on the existing Concert) or create a second Concert
**And** cancel keeps the draft (UX-DR18)

**Given** the same artist and date with different times
**When** I save
**Then** create is allowed (`created`) without that choice

**Given** a timed exact match
**When** a second insert is attempted outside the UI
**Then** the database unique-guard rejects it
**And** the untimed case is not enforced by unique index alone (AD-10, AD-11)

### Story 1.5: Record Attendance on a Concert

As a signed-in User,
I want to mark a Concert Going or Attended, leave it unset, and have Going become Attended after the Paris boundary,
So that the Bill can include acts I did not see, without a skipped value.

**Acceptance Criteria:**

**Given** a future Concert on an Event I own
**When** I tap the unset ghost chip
**Then** my Attendance becomes `going` with visible label "Going" (hollow neon pill)
**And** the accessible name is "Mark as going" (FR-4, UX-DR12)

**Given** a past Concert
**When** I tap the unset ghost
**Then** my Attendance is stored as `attended` (never stored as `going` on a past Concert)
**And** the chip is a quiet solid muted outline "Attended"
**And** setting `attended` on a still-future Concert is rejected (FR-4, AD-3)

**Given** my Attendance is `going` and the Concert is past in Europe/Paris (after optional clock time, else end of that Paris calendar day)
**When** I view Home, Concerts, Event, or later MCP/Shared List
**Then** effective Attendance is `attended` from a single SQL definition
**And** the UI does not display the raw `going` column (AD-3, UX-DR24)

**Given** I clear Attendance at the past boundary
**When** the clear succeeds
**Then** the row is deleted (unset = no row) and auto-attended does not immediately re-set it (FR-4, AD-11)

**Given** I try to change `attended` to `going`
**When** I save
**Then** the change is rejected

**Given** a Concert with no Attendance for me
**When** I view the Event
**Then** the Concert still appears with a dashed ghost of the next state ("Going" if upcoming, "Attended" if past)
**And** never "Set", "On the bill", "Skipped", or a third chroma (FR-9, UX-DR12)

**Given** Concerts added onto an existing Event
**When** they are created
**Then** Attendance starts unset for me (owner default is Story 1.6 only) (FR-4)

**Given** Attendance is stored
**When** another User exists in later epics
**Then** this story already forbids selecting another User's Attendance in RLS (AD-2, AD-11)
**And** the only new table is `attendance` (one row per User per Concert when set)

### Story 1.6: Log a one-performer show from Add

As a signed-in User,
I want to add a Concert from nav Add without picking an Event first,
So that a one-performer night becomes an Event-backed Concert in one save (UJ-1).

**Acceptance Criteria:**

**Given** I am on Home or Concerts
**When** I open nav Add, enter artist, date, and Place, and save without selecting an Event
**Then** LiveMemory creates a `single_night` Event I own named `Concerts on {DD/MM/YYYY} at {Place}` using that Concert's Europe/Paris date and Place (FR-2, AD-12)

**Given** that Concert's date is past
**When** the transparent create succeeds
**Then** my Attendance is `attended`
**And** if the date is still future, my Attendance is `going` (FR-4)

**Given** the new Event has exactly one Concert
**When** I view Concerts
**Then** I see a compact Event card: artist once as the title, one meta line (date · Place · time), Event name as a second muted line only if it differs from the artist, Attendance chip on the right
**And** the whole card opens Event view; chip tap cycles Attendance and does not open Edit (UX-DR8)

**Given** I later add a second Concert to that Event (Story 1.3 flow)
**When** the Bill has 2+ Concerts
**Then** Concerts shows an Event group, not two compact cards
**And** owner Attendance default does **not** apply to the added Concert (FR-4, AD-12)

**Given** transparent create and Event-first create
**When** I compare fields, rules, and Concerts appearance
**Then** they produce the same domain records (FR-2)

### Story 1.7: See featured nights and souvenir stats on Home

As a signed-in User,
I want Home to show my next 1–3 upcoming Events and three souvenir counts,
So that landing feels like planning a night, not a dashboard of the whole log.

**Acceptance Criteria:**

**Given** I have upcoming owned Events
**When** I open Home
**Then** featured shows the next 1–3 by start date (including empty owned Events if they rank)
**And** 2+ Concerts: Event name `{typography.display-sm}` then day-grouped rows; 1 Concert: artist as `{typography.display-sm}` compact anatomy
**And** tapping a featured Event opens `/e/:id` (FR-8, UX-DR9)

**Given** featured is showing
**When** I scroll Home
**Then** I do not see the rest of the log; remaining Events live on Concerts only (FR-8)

**Given** I have Attendance and Events
**When** I view the stats block under featured
**Then** one card shows three counts in one row: all-time `attended` Concerts, all-time Events I own (joined Events added in Epic 2), current `going` Concerts
**And** stats are not tappable and are not charts (FR-8, UX-DR10)
**And** zeros are allowed when empty (UX-DR17)

**Given** a `going` Concert becomes past
**When** I reload Home
**Then** it leaves featured if it was there and sits with past Events on Concerts; no "How was it?" interstitial (UX-DR24)

**Given** Home composition
**When** compared with `mockups/key-home.html`
**Then** spines win on conflict; no “for you” feed, no album-art slots (UX-DR23)

### Story 1.8: Edit Concerts, write notes, and delete Concerts

As an Event owner,
I want to edit a Concert (including notes), move is later, and delete it from the Bill,
So that I can correct the night without destroying the Event when it is the last Concert.

**Acceptance Criteria:**

**Given** I own a Concert
**When** I tap the Concert row on the Event
**Then** the same glass Add sheet opens in edit mode with current fields (UX-DR13)

**Given** I am the Event owner
**When** I save optional notes
**Then** notes persist on `concerts` (column added in this story) and I see only my notes
**And** RLS allows notes SELECT/UPDATE for the Event owner only
**And** the notes placeholder is "Private. Never on your public profile." (FR-3, UX-DR16)

**Given** I delete a Concert
**When** no non-owner has joined (joiners are Epic 2)
**Then** the Concert is removed from the Bill, my Attendance on it is deleted, and my notes are deleted (FR-2)

**Given** I delete the last Concert on an Event
**When** delete succeeds
**Then** the Event remains with zero Concerts and I can still open it (FR-2, FR-11)

**Given** a Concert cannot exist without an Event
**When** I inspect the schema
**Then** `concerts.event_id` is not null (FR-2, AD-10)

### Story 1.9: Update Event rules without breaking the Bill

As an Event owner,
I want to edit Event dates, Place, Stage/Scene list, and Place-override policy, with Concerts kept valid,
So that a festival correction cannot deadlock against existing rows.

**Acceptance Criteria:**

**Given** I own an Event
**When** I update name, dates, Place, or per-Concert Place-override (default off)
**Then** the Event is saved and joiners cannot do this (no joiners yet; RLS owner-only) (FR-5)

**Given** I add Stage/Scene rows on an Event
**When** I add a Concert
**Then** I must pick a `stage_id` from that list; Concert stores `stage_id` not a copied name
**And** an empty list means Stage/Scene is not required
**And** rename does not detach Concerts (AD-9, FR-12)

**Given** override is off
**When** I try to save a Concert Place that conflicts with the Event Place
**Then** save is rejected and the message names the Place rule (FR-12)

**Given** a Concert date outside the inclusive Event range
**When** I save
**Then** I see "This date is outside the Event." plus the Event's range, and save is blocked (FR-12, UX-DR16)

**Given** an Event date change that would invalidate existing Concerts
**When** I save Event dates alone
**Then** the update is blocked and lists every affected Concert and failed rule (FR-5, FR-12, AD-13)

**Given** I need to correct a range
**When** I save Event dates and Concert dates in one domain operation
**Then** every Concert remains valid and the save succeeds (FR-12, AD-13)

**Given** validation fails
**When** the domain returns an error
**Then** the message names the failed rule (dates, Stage/Scene, required fields, ownership, or Concert identity) (FR-13, NFR-5, AD-11)
**And** hard rules are enforced in the database, not only in Vue (NFR-15)

### Story 1.10: Move a Concert between owned Events

As an Event owner,
I want to move a Concert from one Event I own to another I own without duplicating it,
So that an artist filed on the wrong night can be corrected in place.

**Acceptance Criteria:**

**Given** I own source and target Events
**When** I move a Concert to the target
**Then** there is still exactly one Concert row; `event_id` updates; Attendance and notes stay on that Concert id (FR-6)

**Given** the target Event's dates, Place policy, or Stage/Scene list reject the Concert
**When** I move
**Then** the move is blocked and the failed rule is named (FR-6, FR-12)

**Given** I move the last Concert off an Event
**When** the move succeeds
**Then** the source Event remains with zero Concerts (FR-6)

**Given** two Concerts on the same date and Place
**When** they belong to one Event
**Then** both may exist (FR-6)

**Given** no joiners exist yet
**When** I move
**Then** no joiner-impact confirm is required (that confirm is Story 2.6)

### Story 1.11: Delete an Event

As an Event owner,
I want to delete an empty Event immediately, and a non-empty Event only after confirming the Bill will be destroyed,
So that I can remove a night without leaving orphan Concerts.

**Acceptance Criteria:**

**Given** an Event with zero Concerts
**When** I delete it as owner
**Then** the Event is gone, `/e/:id` becomes unknown (quiet not-found), and no Concert warning is used (FR-11, UX-DR17)

**Given** a non-empty Event
**When** I delete without confirming
**Then** delete does not complete (FR-11, UX-DR19)

**Given** I confirm non-empty delete
**When** delete succeeds
**Then** the Event, its Concerts, Attendance, and owner notes are deleted
**And** no Concert survives without an Event (FR-11)

**Given** I am not the owner
**When** I attempt delete (RLS / domain)
**Then** it is blocked (FR-11)
**And** joiner-named copy is Story 2.6

### Story 1.12: Attend this night

As a User on a single-night Event,
I want one action to mark Attendance on every Concert currently on that Bill,
So that I do not tap each artist after a soirée.

**Acceptance Criteria:**

**Given** a `single_night` Event with Concerts on the Bill
**When** I tap **Attend this night**
**Then** each current Concert becomes `going` before the Europe/Paris boundary and `attended` after it (FR-10, AD-12, UX-DR15)

**Given** I then add another Concert
**When** I view Attendance
**Then** the new Concert starts unset; I must tap attend-all again if I want it (FR-10)

**Given** I clear Attendance on one Concert after attend-all
**When** clear succeeds
**Then** that Concert stays on the Bill unset (FR-10)

**Given** a `festival` Event
**When** I view Event
**Then** there is no control that marks every Concert going or attended in one action (FR-10)

### Story 1.13: Polish lists, empty and error states, and accessibility

As a signed-in User,
I want Concerts and Event lists to match the spines at ~1,000 Concerts, with WCAG 2.2 AA and honest empty/error states,
So that the private log is usable on phone and desktop without looking like a spreadsheet.

**Acceptance Criteria:**

**Given** a cold load of Home, Concerts, or Event
**When** data is not ready
**Then** `USkeleton` matches featured+stats or groups (UX-DR17)

**Given** a fetch fails
**When** I am on Home, Concerts, or Event
**Then** I see "Couldn't load." with Retry (UX-DR17)

**Given** about 1,000 Concerts
**When** I open Concerts
**Then** the list paginates or windows (no infinite scroll) and completes within 2 seconds under normal use
**And** a muted "Loading more" row appears while the next page fetches (NFR-4, UX-DR17, UX-DR21)

**Given** I am offline
**When** I try to write
**Then** a toast is shown and the write is blocked; no offline queue (NFR-13)

**Given** I use a keyboard and screen reader
**When** I change routes
**Then** the surface is announced ("Home", "Concerts", "Event: {name}", "Profile")
**And** focus rings stay visible on black
**And** reduced motion drops blur animation and Going-chip glow but keeps outlines (NFR-10, UX-DR5, UX-DR22)

**Given** list and Event composition
**When** compared with `mockups/key-concerts.html`, `key-event.html`, and `key-add-sheet.html`
**Then** spines win on conflict; no hover-only actions on `< md`; no drag-and-drop line-up; modal stack is one level (UX-DR21, UX-DR23)

## Epic 2: Share a night without giving the Bill away

Pierre sends an Event URL or enables a Shared List. Sam can view, join, set only his Attendance, and leave — never edit the Bill or see notes. Event links work with the public profile off. Joiner-impact confirms for Concert delete, Concert move, and Event delete land here once membership exists. Every story adds or updates tests. Joined Events appear on the joiner's Home featured and Concerts using Epic 1 list rules.

### Story 2.1: Join an Event via its URL

As a signed-in User who is not the owner,
I want opening `/e/:id` to join me to that Event,
So that I can see the shared Bill without searching a directory.

**Acceptance Criteria:**

**Given** I am signed in and not the owner
**When** I open a valid Event URL
**Then** domain join inserts `event_members (event_id, user_id)` and I see the same Concerts as the owner (FR-18, AD-8)
**And** the owner is not stored in `event_members`

**Given** I already joined
**When** I open the same URL again
**Then** it is view, not a second join (FR-18)

**Given** I am signed out
**When** I open a valid Event URL
**Then** I am redirected to Sign in with `redirect` back to that Event
**And** after sign-in or register I land on that Event and am joined (FR-18, AD-2, UX-DR18)

**Given** after `/confirm`
**When** a `redirect` to an Event URL is present
**Then** I am sent there; otherwise I land on Home (AD-2)

**Given** the Event id is unknown
**When** I open `/e/:id`
**Then** I see the same quiet not-found as an unknown Shared List; no enumeration (FR-18, UX-DR17)

**Given** I have joined
**When** I open Concerts and Home
**Then** the Event appears on Concerts (even with no Attendance for me)
**And** it appears in Home featured if it is among my next 1–3 upcoming
**And** Home souvenir stats count all-time Events as owned + joined, and current `going` / all-time `attended` include Concerts on joined Events (FR-8, FR-18)
**And** owner and members may SELECT that Event and its Concerts; notes remain owner-only (AD-2, AD-8)

**Given** I own the Event
**When** I am on `/e/:id`
**Then** that URL is the unguessable Event link I can give to others
**And** optional quiet copy of the URL is allowed; there is no share sheet, invite modal, or directory (FR-18, UX-DR20)

**Given** the owner's public profile is off
**When** I use the Event URL
**Then** join still works (FR-14, FR-18)

### Story 2.2: Set my own Attendance as a joiner

As a joiner,
I want to set or clear only my Attendance on the Bill, including Attend this night on a soirée,
So that I can plan what I will see without editing Pierre's lineup.

**Acceptance Criteria:**

**Given** I am a joiner on the Event
**When** I view the Event
**Then** I see every Concert on the Bill and only my Attendance chips
**And** Add / Edit Concert / Edit Event / Delete Event are hidden, not disabled
**And** owner notes and other Users' Attendance are not shown
**And** I have no notes field (FR-3, FR-9, FR-18, UX-DR18)

**Given** I set, change, or clear my Attendance
**When** the save succeeds
**Then** only my `attendance` row changes; FR-4 transitions still apply (FR-18, FR-4)

**Given** a `single_night` Event
**When** I tap **Attend this night**
**Then** only my Attendance on current Bill Concerts is updated (FR-10, FR-18)

**Given** I try to add, edit, move, or delete a Concert or update the Event
**When** I call the domain as a joiner
**Then** the operation is blocked (FR-2, FR-5, FR-18, AD-11)

### Story 2.3: Leave an Event

As a joiner,
I want to leave an Event after confirming,
So that it disappears from my Home and Concerts without changing the owner's Bill.

**Acceptance Criteria:**

**Given** I am a joiner
**When** I tap **Leave Event**
**Then** I see confirm copy: "Leave this Event? It will leave your list. The bill stays for the owner."
**And** Leave is a quiet control, not `{components.button-primary}` (FR-18, UX-DR15, UX-DR16, UX-DR19)

**Given** I confirm leave
**When** leave succeeds
**Then** my `event_members` row is deleted, my Attendance on that Event's Concerts is deleted, and the Event leaves my Home and Concerts
**And** the Bill is unchanged for the owner and other joiners (FR-18, AD-8)

**Given** I want to return
**When** I open the Event URL while signed in
**Then** I join again (FR-18)

### Story 2.4: Enable and disable my Shared List

As a User,
I want my public profile off until I enable it, at a URL derived from my username,
So that only people I send the link to can see Going and Attended.

**Acceptance Criteria:**

**Given** a new account
**When** I have never enabled sharing
**Then** `/u/:username` is not visible (same quiet not-found as unknown username) (FR-14, FR-15, AD-2)

**Given** I am on Profile
**When** I enable sharing
**Then** a profile flag persisted in this story turns sharing on
**And** the Shared List is reachable at `/u/:username` without signing in
**And** I can copy the URL with the outline primary CTA
**And** helper copy is: "Friends see Going and Attended. They can open an Event to join — they never edit your bill or see notes." (FR-15, UX-DR16, UX-DR20)

**Given** copy fails
**When** the clipboard error occurs
**Then** a toast shows "Couldn't copy the link." (UX-DR17)

**Given** I disable sharing
**When** a visitor opens `/u/:username`
**Then** the result matches unknown username; copy does not say the user exists but is private (FR-15, UX-DR17)

**Given** Event links exist
**When** sharing is off
**Then** Event URLs still work (FR-14)

**Given** there is no User directory
**When** I look for search of Users
**Then** v1 has none (FR-15)

### Story 2.5: Browse a Shared List and open an Event to join

As a visitor,
I want to see only that User's Going and Attended Concerts, grouped by Event, and tap a grouping to join,
So that I can follow a night Pierre shared without writing on the profile page.

**Acceptance Criteria:**

**Given** sharing is on and the User has `going` or `attended` Concerts (effective Attendance, AD-3)
**When** I open `/u/:username` signed out or as someone else
**Then** I see those Concerts grouped by Event using Event group / compact rules
**And** notes, unset Attendance, and Events with no visible Concerts are omitted
**And** there are no create/update/delete controls on the Shared List page (FR-16, AD-2, UX-DR7, UX-DR8)

**Given** I am signed in as someone else
**When** I view the Shared List
**Then** I still cannot write on that page (FR-16)

**Given** sharing is on but nothing is visible
**When** I open the profile
**Then** I see "Nothing to show yet." and no Add CTA (UX-DR17)
**And** this is distinct from disabled/unknown not-found (AD-2)

**Given** I tap a grouping
**When** the Event URL opens
**Then** viewing the Shared List did not join me; join happens on the Event after sign-in (FR-16, FR-18)

**Given** I joined from a Shared List Event
**When** I view that Event
**Then** I see the full Bill (including Concerts the profile User did not mark) and can set only my Attendance (FR-16)

**Given** the profile User has Attendance on an Event they do not own
**When** that Concert is `going` or `attended` for them
**Then** it may appear on their Shared List and tapping still opens that Event so I can join it (FR-16)

**Given** unauthenticated reads
**When** they hit the database
**Then** they may SELECT only the kernel public Shared List view; not notes, Bill-only rows, other Users' Attendance, or private Events (AD-2, NFR-1, NFR-3)

**Given** a screen reader on Shared List
**When** the page loads
**Then** it announces "Shared list for {username}" and does not announce missing notes or bill-only Concerts (UX-DR22)
**And** Auth redirect excludes `/u/**` so the public profile does not force login (AD-2)

### Story 2.6: Confirm when joiners would lose a Concert or Event

As an Event owner,
I want to confirm delete or move when someone has joined,
So that I do not silently wipe another User's Attendance.

**Acceptance Criteria:**

**Given** any non-owner has joined
**When** I delete a Concert
**Then** I must confirm; copy names that joiners will lose that Concert and their Attendance on it (FR-2)

**Given** any non-owner has joined the source Event
**When** I move a Concert to another Event I own
**Then** I must confirm; copy names that joiners of the source who are not joiners of the target will lose that Concert from their Bill view
**And** those joiners are not auto-joined to the target (FR-6, AD-8)

**Given** any non-owner has joined
**When** I delete a non-empty Event
**Then** confirmation copy names that joiners lose the Event, its Concerts, and their Attendance (FR-11)

**Given** I delete the Event
**When** delete succeeds
**Then** joiners no longer see it on Home or Concerts and the Event link is unknown (FR-11, FR-18)

## Epic 3: Let an agent write the same log

Pierre creates and revokes a personal key. An authenticated agent can list, read, create, update, move, and delete Events and Concerts (including Attendance and joins) under the same owner vs joiner rights and validation as the UI. Not a second product. Screenshot interpretation stays outside LiveMemory. Every story adds or updates tests. Choose the MCP SDK in this epic (architecture deferred the library).

### Story 3.1: Create and revoke a personal MCP key

As a signed-in User,
I want to create and revoke a personal key in the app,
So that an agent can act as me without putting my password in its config.

**Acceptance Criteria:**

**Given** I am on Profile
**When** I create a personal key
**Then** I am shown the plaintext once
**And** only a hash is stored on a `personal_keys` table (UUID, user-scoped) created in this story
**And** Nitro can verify the hash and mint a user-scoped client (AD-4)

**Given** I revoke the key
**When** an agent presents it afterward
**Then** the call is rejected
**And** v1 has no expiry policy beyond revoke (AD-4)

**Given** domain Event/Concert tables
**When** the key exchange runs
**Then** `service_role` is not used to read or write those tables (AD-1, AD-4, NFR-15)

### Story 3.2: Let an agent create and update my log

As a User with a valid personal key,
I want an MCP agent to list, read, create, update, move, and delete Events and Concerts (including Attendance) with the same validation as the UI,
So that I can file structured data without typing every row.

**Acceptance Criteria:**

**Given** a valid personal key
**When** the agent creates a Concert or Event
**Then** the row is indistinguishable in the UI from one created in the form (same fields, same rules) (FR-17, UX-DR24)

**Given** Concert identity cases
**When** the agent creates
**Then** outcomes are `attached`, `impossible_place`, `needs_choice`, or `created` — the same attach-or-create choice as the UI, not warn-then-save-anyway (FR-13, FR-17, AD-10)

**Given** Event delete, move, and date rules
**When** the agent mutates
**Then** FR-11, FR-12, and FR-6 apply unchanged (FR-17)

**Given** MCP tools
**When** they persist
**Then** they call `shared/domain` after Nitro mints the user-scoped client; they do not invent SQL (AD-1)
**And** this story ships after UI CRUD (Epic 1); it is not a substitute for the first UI path (addendum, FR-17)

### Story 3.3: Limit an agent to the acting User's rights

As Pierre,
I want a joiner's agent unable to edit the Bill, and an unauthenticated caller unable to write,
So that MCP is not a back door around Event ownership.

**Acceptance Criteria:**

**Given** a personal key for a joiner
**When** the agent tries to add, edit, move, or delete Concerts or update the Event
**Then** the operation is blocked, same as the joiner UI (FR-17, FR-18)

**Given** a joiner's agent
**When** it sets Attendance, uses attend-all on a soirée, joins via Event id, or leaves
**Then** those operations follow FR-18 and FR-10 (FR-17)

**Given** no key or an invalid key
**When** a caller writes
**Then** the write fails (FR-17)

**Given** effective Attendance and Shared List rules
**When** the agent reads
**Then** it uses the same domain/SQL definitions as the UI (AD-3, NFR-6)
