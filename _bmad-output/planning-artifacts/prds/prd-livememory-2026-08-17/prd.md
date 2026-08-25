---
title: LiveMemory
status: final
created: 2026-08-17
updated: 2026-08-18
---

# PRD: LiveMemory

## 0. Document Purpose

This PRD is for Pierre (owner-builder) and for downstream UX, architecture, and stories. It expands the aligned canonical contract in `_bmad-output/specs/spec-livememory/`. Glossary terms are binding.

Draft UX spines live in `_bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/` (`DESIGN.md`, `EXPERIENCE.md`, `mockups/`). Signed-in IA is **Home** + **Concerts** as in those spines. SPEC and this PRD win on product behavior. Those spines win on interaction, chrome, and visuals. This PRD does not invent visual design. Shipped UI copy is English.

Factory stack, MCP mechanism, and landscape notes live in `addendum.md`.

## 1. Vision

LiveMemory is Pierre's private log of nights out: single-night shows and festivals as Events, Concerts as performances on each Bill, and optional per-User Attendance for whether he is going or went. Every Concert belongs to one Event. An Event is one shared record: Pierre owns the Bill; other Users can join via an Event link and record their own Attendance. Pierre may also expose a separate read-only public profile.

He can plan ahead (Going). After a Concert he marked `going` has passed in Europe/Paris, its Attendance becomes `attended`. A Concert can sit on an Event with no Attendance for him — it is on the Bill, and he is not `attended`. A few people can use the Event itself, or his Shared List, without getting write access to the Bill. From the Shared List they can open an Event and join it (FR-18).

## 2. Glossary

- **User** — A person with an account and a unique username. Owns Events they create. v1 is individual accounts only.
- **Event owner** — The User who created the Event. Only this User can edit or delete the Event and its Bill in v1.
- **Home** — Default signed-in landing. Featured upcoming Events (owned and joined, next 1–3 by start date), then a small souvenir stats block. Not the full log.
- **Concerts** — The signed-in User's full Event log: Events they own (including empty) and Events they have joined, grouped, upcoming then past. Distinct from **Home**, from **Shared List**, and from **Event view**.
- **Concert** — One artist or group performing on a date (optional time). Belongs to exactly one Event. Optional Stage/Scene. Attendance is per User. Notes are Event-owner-only in v1.
- **Event** — A group of Concerts: `single_night` (soirée) or `festival`. One shared record. Has a name, date or date range, Place, optional Stage/Scene list, optional per-Concert Place override, and an unguessable Event link. May exist with zero Concerts. Festivals span days; single-night Events use the same start and end date.
- **Place** — The **city** where an Event or Concert happened. Not the venue. Inherited from the Event unless that Event allows overrides.
- **Stage/Scene** — The **venue or stage** name (room, hall, or festival stage). Optional; strongly recommended. The User may type a new name when adding a Concert. A defined list is a suggestion set, not a closed required enum.
- **Attendance** — Optional per User on a Concert: `going` (shipped label "Going") or `attended`. Absent means the Concert is only on the Event Bill for that User. There is no skipped value. "J'y vais" is a spoken synonym, not UI copy.
- **Bill** — The Event-owner-entered set of Concerts on an Event. Shared with joiners. v1 is not a scraped or canonical festival database.
- **Event link** — Unguessable URL for one Event. The only write-join path: a signed-in User who opens it can view the Bill and set their own Attendance. Reachable by copying the Event URL or by tapping an Event on an enabled Shared List. A joiner can leave. No Event search in v1. Rotation, owner kick, and a joiner roster are out of v1.
- **Shared List** — Read-only public profile at a User's username-derived URL. Shows that User's `going` and `attended` Concerts grouped by Event, including Concerts on Events they do not own. Omits notes, Concerts without Attendance for that User, and Events with no visible Concerts. Tapping a grouping opens that Event (FR-18): the visitor can join and then see the full Bill and set their own Attendance. The Shared List page itself has no write controls.

## 3. Target User

### 3.1 Jobs To Be Done

- Functional: keep Events (single-night shows and festivals) as groups of Concerts; record the Bill; mark what he plans to see and what he saw; let an Event prefill Concert entry.
- Emotional: history that feels like his nights, not a public attendance score.
- Social: show a few people a night via an Event link or via the Shared List (they can open an Event and join), without giving Bill write access.
- Contextual: use a browser after the fact or while planning; ~1,000 Concerts stay usable; an agent should be able to enter the same structured data early (screenshot interpretation happens outside LiveMemory).

### 3.2 Non-Users (v1)

Bands, households, collaborative editors. People looking for tickets, alerts, or a global setlist wiki.

### 3.3 Key User Journeys

- **UJ-1. Pierre logs a one-performer show after a night out.**
  - **Persona + context:** Pierre, rebuilding his own log.
  - **Entry state:** signed in on the web app. `[ASSUMPTION: he uses a browser, not a native app.]`
  - **Path:** lands on Home → Add → adds a Concert (artist or group, date, Place, optional time and notes) → LiveMemory transparently creates a single-night Event named from that date and Place, containing that Concert → Attendance is `attended` because the date is past.
  - **Climax:** the Event-backed Concert is on Concerts (compact card) and survives sign-out / sign-in.
  - **Resolution:** he can edit or delete the Concert and edit its Event. Realizes FR-1, FR-2, FR-3, FR-4, FR-5.

- **UJ-2. Pierre sets up a single-night Event, then the Bill.**
  - **Persona + context:** a multi-artist night at one Place; he often knows the Event before every artist.
  - **Entry state:** signed in; Event may have zero Concerts.
  - **Path:** creates a `single_night` Event (name, date, Place) → adds Concerts; date and Place are prefilled; he mainly enters each artist or group → uses the attend-all shortcut so every Concert currently on the Bill is `going` (future) or `attended` (past).
  - **Climax:** the Event view shows every Concert on that Bill; Attendance is visible; Concerts shows the Event grouped.
  - **Resolution:** he can clear Attendance on one Concert; it stays on the Event Bill without him as `attended`. Realizes FR-5, FR-7, FR-8, FR-9, FR-10, FR-12.

- **UJ-3. Pierre files a festival and marks what he will see.**
  - **Persona + context:** several days, optional Stage/Scene list.
  - **Path:** creates a `festival` Event first → adds Concerts (picks the day in range, artist or group, optional Stage/Scene, optional time); those rows start unset for him → labels Concerts he will see as `going`. No "attend the whole festival" shortcut.
  - **Climax:** Event view shows the owner-entered Bill by day, with Attendance on each Concert.
  - **Resolution:** after a `going` Concert passes it becomes `attended`; Concerts he never marked `going` stay on the Bill without Attendance. Realizes FR-4, FR-5, FR-7, FR-9, FR-12.

- **UJ-4. Pierre sends the Shared List to a few people.**
  - **Persona + context:** Sam gets Pierre's username-derived profile URL. Visitors arrive from a URL Pierre sends, not search or a User directory.
  - **Path:** sharing on → Sam opens the Shared List signed out or as someone else → sees Pierre's `going` and `attended` grouped by Event → taps an Event.
  - **Climax:** Sam lands on that Event (sign-in first if needed), sees the full Bill, can join and mark his own Attendance. He cannot edit the Bill. Pierre's notes stay hidden.
  - **Resolution:** a disabled profile or unknown username is not visible. Realizes FR-14, FR-15, FR-16, FR-18.

- **UJ-5. Sam joins Pierre's festival via an Event link.**
  - **Persona + context:** Sam is signed in. Pierre sends the Event link, not a search result.
  - **Path:** Sam opens the link → if he was signed out, he signs in and returns to this Event → sees the shared Bill → marks some Concerts `going` → cannot edit artists, dates, notes, or delete the Event.
  - **Climax:** Sam's Attendance is his own; Pierre's notes and Attendance stay hidden from Sam. Sam has no notes field.
  - **Resolution:** the Event appears on Sam's Concerts (and Home featured if it is among the next 1–3 upcoming). Pierre remains Event owner. Sam can leave; the Event then leaves his Home and Concerts. Realizes FR-4, FR-8, FR-9, FR-18.

## 4. Constraints and Guardrails

**Privacy.** The public profile is off until enabled. Notes are Event-owner-only in v1 and never appear on another User's Event view or Shared List. Attendance is per User and never appears on another User's Event view or Shared List. Shared List visitors do not write on the profile page. They may open an Event that appears there and join via FR-18. Individual accounts only.

**Platform.** Responsive web at `https://livememory.pierre-reynaud.fr`. No PWA in v1.

**Safety.** Shared List visitors must not gain write access on the profile page. Event-link joiners must not edit the Bill. Agents write only within the acting User's rights.

**Performance.** Lists of about 1,000 Concerts remain usable, and the complete list loads within 2 seconds under normal use.

**Validation.** Copy names the failed rule (dates, Stage/Scene, required fields, or ownership).

**Write-path parity.** UI and machine-interface writes enforce the same Event rules.

**Factory stack.** Binding: Nuxt 4, Nuxt UI, Pinia for remote data, SQL migrations with RLS, no Prisma, Playwright against local Supabase only, every story adds or updates tests. Detail in `addendum.md`.

## 5. Features

### 5.1 Account and Concert records

**Description:** A User can register, sign in, and sign out, then create, view, update, and delete Concerts — including future dates. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Account

A User can register with email, password, and a unique username, then sign in and sign out.

**Consequences (testable):**
- Registration requires a username. Allowed characters are `a-z`, `0-9`, `_`, and `-`. Uniqueness is case-insensitive. Collision copy is "This username is taken".
- The username is immutable in v1 (rename is a Non-Goal).
- After register and sign-in, the User lands on Home.
- Sign-out returns them to an unauthenticated state; Home and Concerts are not shown.
- Shared List cannot be enabled without a username; v1 always has one from registration.

#### FR-2: Concert CRUD

A User who owns an Event can create, view, update, and delete Concerts on that Event. A Concert requires artist or group, date, and exactly one Event. Time is optional. Date may be in the future. Nav Add always chooses an Event first (an existing owned Event, **New night**, or **New festival**). New night without a custom name creates a `single_night` Event named `Concerts on {DD/MM/YYYY} at {Stage}, {Place}` when Stage/Scene is filled, otherwise `Concerts on {DD/MM/YYYY} at {Place}` (Europe/Paris calendar date, city Place, optional venue/stage). The owner can edit the name afterwards. Joiners cannot create, update, or delete Concerts.

**Consequences (testable):**
- A created Concert belongs to the Event's Bill and is visible to the Event owner and to signed-in Users who opened that Event link.
- The Concert is still there after the owner signs out and signs in.
- Delete removes it from the Bill for every User on that Event and deletes every User's Attendance on that Concert and the Event owner's notes on it.
- When any non-owner has joined the Event, Concert delete requires confirmation; copy names that joiners will lose that Concert and their Attendance on it.
- A Concert with a future date can be saved.
- A Concert without a time can be saved.
- A Concert cannot exist without an Event.
- Transparent Event creation and explicit Event-first creation produce the same fields, rules, and Concerts appearance.
- A joiner who tries to add, edit, or delete a Concert is blocked.
- Deleting the last Concert on an Event leaves the Event in place with zero Concerts. The owner can then delete that empty Event (FR-11).

#### FR-3: Private notes

The Event owner can attach optional notes to a Concert. Joiners cannot. Notes stay private: nobody sees another User's notes.

**Consequences (testable):**
- The Event owner sees only their own notes on a Concert.
- A joiner has no notes field and cannot create, update, or delete notes.
- Notes never appear on a Shared List (FR-16) or on another User's Event view.

#### FR-4: Attendance

Attendance is per User on a Concert: `going`, `attended`, or none. There is no skipped value. A User can clear only their Attendance; the Concert remains on the Event. Once a User's `going` Concert has passed, that User's Attendance becomes `attended` automatically.

Owner default applies only to transparent one-Concert Event creation (FR-2 / UJ-1): a newly created future Concert defaults to `going` for the Event owner; a newly created past Concert defaults to `attended` for the Event owner. Concerts added onto an existing Event — including festival Bills and Event-first soirées — start unset for everyone, including the Event owner. Other Users always start unset on a Concert. FR-10 is a one-shot bulk action on Concerts already on a `single_night` Bill; it does not change later-added Concerts.

Allowed transitions: on a past Concert, Attendance is `attended` or unset (`going` set on a past Concert becomes `attended` immediately). On a future Concert, Attendance is `going` or unset (`attended` on a future Concert is rejected). `attended` cannot be changed to `going`. Clearing Attendance at the Europe/Paris past boundary stays unset; auto-`attended` does not immediately re-set it.

**Consequences (testable):**
- Shipped label copy for `going` is "Going". The glossary token remains `going`.
- After a User's `going` Concert is past, that User's Attendance is `attended` without a further click.
- A Concert with no Attendance for a User stays on the Event and is not `attended` for that User.
- Clearing Attendance does not delete the Concert.
- One User's Attendance is never shown on another User's Event view.
- "Past" means after the optional time on that date, or after the end of that calendar date in Europe/Paris when time is empty.
- Adding a Concert to an existing Event leaves every User's Attendance unset, including the owner.
- Setting `going` on a Concert that is already past stores `attended`.
- Setting `attended` on a Concert that is still future is rejected.
- Changing `attended` to `going` is rejected.
- A successful clear of `going` at the past boundary remains unset.

### 5.2 Events as groups

**Description:** Events are the required grouping for Concerts: single-night shows and festivals. The User can create and edit an Event explicitly, or let the first Concert transparently create a single-night Event. Adding a Concert from an Event prefills what the Event already knows. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-5: Create and update Event

The Event owner can create and update an Event as `single_night` or `festival`, with name, date or date range, Place, optional Stage/Scene list, and a per-Concert Place-override policy. An Event may have zero Concerts. Joiners cannot update the Event.

**Consequences (testable):**
- A festival Event accepts a start and end date that can span days. Start and end are inclusive Europe/Paris calendar dates.
- A single-night Event uses the same start and end date.
- An Event with no Stage/Scene list allows Concerts without a Stage/Scene.
- An Event with zero Concerts is saved and listed on Concerts. It also appears in Home featured if it is among the next 1–3 upcoming Events the User owns or has joined.
- An update that would invalidate existing Concerts is blocked and lists the affected Concerts and failed rules, unless the owner saves Event dates and Concert dates together in one operation that leaves every Concert valid (FR-12).
- Per-Concert Place override defaults to off.
- A joiner who tries to update Event fields is blocked.

#### FR-6: Move without duplicating

The Event owner can add Concerts to an Event and move a Concert from one Event they own to another Event they own.

**Consequences (testable):**
- Moving a Concert does not create a second record.
- A move is blocked when the target Event's dates, Place policy, or Stage/Scene list reject the Concert.
- The Concert always belongs to exactly one Event.
- An Event may hold many Concerts on the same date and Place.
- Per-User Attendance and notes stay on that Concert id and remain visible only where that User may view the Concert.
- Joiners of the source Event who are not already joiners of the target do not see the Concert after the move and are not auto-joined to the target.
- When any non-owner has joined the source Event, the owner confirms the move; copy names that joiners of the source who are not joiners of the target will lose that Concert from their Bill view.
- Moving the last Concert off an Event leaves that Event in place with zero Concerts.

#### FR-7: Prefill from Event

When the User adds a Concert from an Event, the Event supplies defaults and constraints.

**Consequences (testable):**
- From a `single_night` Event: date and Place are prefilled; the User mainly enters the artist or group.
- From a `festival` Event: Place (city) is prefilled; the User still chooses the day inside the Event range, the artist or group, and may enter a Stage/Scene (venue or stage) immediately.
- The new Concert belongs to that Event without a second record.

#### FR-8: Home and Concerts

Concerts on an Event display together; festivals display by day. Grouped Events are the common list shape. After sign-in the User lands on **Home**. The full log lives on **Concerts**.

**Consequences (testable):**
- Home shows the next 1–3 upcoming Events the User owns or has joined, then a souvenir stats block: all-time `attended` Concerts, all-time Events (owned + joined), current `going` Concerts. Stats are not tappable and are not a dashboard. Further counts are later, not v1.
- Home does not list the rest of the log.
- Concerts lists Events the User owns, including empty Events, and Events the User has joined, including joined Events with no Attendance for that User, upcoming then past, each Event grouping once.
- A `festival` Event on Concerts or Event view groups Concerts by date inside the Event range.

#### FR-9: Event view is the Bill

The Event view shows every Concert on that Event's Bill and the acting User's Attendance value, if any, for each Concert.

**Consequences (testable):**
- Concerts with no Attendance for the acting User still appear on the Event view.
- The Event view is not limited to `attended` only.
- Another User's Attendance and notes are not shown.

#### FR-10: Single-night attend-all shortcut

On a `single_night` Event, a User can mark Attendance on every Concert currently on that Bill in one action, instead of setting each Concert. Each current Concert becomes `going` before its Europe/Paris boundary and `attended` after it. Concerts added later start unset; the User taps attend-all again if they want those too. There is no persistent flag and no equivalent shortcut for a `festival` Event.

**Consequences (testable):**
- One action updates Attendance only on Concerts that exist on the Bill at that moment.
- A Concert added afterwards starts unset for that User.
- The User can afterwards clear Attendance on an individual Concert; it stays on the Bill.
- A `festival` Event has no control that marks every Concert attended or going in one action.

#### FR-11: Delete Event

Deleting a non-empty Event is Event-owner-only and requires explicit confirmation that the Event and all its Concerts will be deleted for every joiner. The Event owner can delete an Event that has zero Concerts; that path does not use the non-empty Concert warning.

**Consequences (testable):**
- A non-empty delete does not complete without confirmation.
- Confirmation copy names that joiners lose the Event, its Concerts, and their Attendance on those Concerts.
- Those Attendance records are deleted with the Concerts. Owner notes on those Concerts are deleted with the Concerts.
- No Concert survives without an Event.
- An empty Event can be deleted by the owner. Joiners then stop seeing it. The Event link becomes unknown.
- A joiner cannot delete the Event.
- After owner delete, joiners no longer see that Event.

### 5.3 Event rules

**Description:** Event date range, Place, optional Stages/Scenes, and Place-override policy constrain Concert entry, moves, and Event updates. Validation for an invalid operation names the failed rule. Realizes UJ-2, UJ-3.

**Functional Requirements:**

#### FR-12: Constrain Concerts by Event

A Concert cannot be saved or moved outside its Event dates, onto a Stage/Scene that is not on that Event after create, or with a conflicting Place (city) when override is off. An Event update cannot leave existing Concerts in any of those invalid states.

**Consequences (testable):**
- Event start and end dates are inclusive Europe/Paris calendar dates.
- Out-of-range dates are rejected.
- A defined Stage/Scene list is an open suggestion set. Typing a new venue or stage name adds it to the Event. Stage/Scene stays optional even when the list is non-empty.
- Event Place is inherited by default; an Event may opt in to per-Concert Place overrides.
- When override is off, a conflicting Place cannot be saved.
- Incompatible Event updates are blocked and list every affected Concert.
- The Event owner can change Event dates and Concert dates in one save so a range correction cannot deadlock against existing Concerts.

#### FR-13: Named validation and Concert identity on create

Validation copy names the failed rule (dates, Stage/Scene, required fields, ownership, or Concert identity). Creating a Concert uses the Event owner's journal. A shared **name** catalog (artists, cities, venues/stages) only powers autocomplete after three characters — it is not a canonical worldwide artist database. This overrides the earlier warn-then-allow duplicate rule.

**Consequences (testable):**
- The message identifies which rule failed.
- Same owner, artist (case-insensitive), date, clock time, and Stage/Scene (case-insensitive, or both empty): no new row; the existing Concert is returned (attach). Attach does not move the Concert to the Event being created under.
- Event is not part of Concert identity. A timed match on a different owned Event still attaches (does not reparent).
- A timed match at a different Stage/Scene creates a second Concert.
- Same owner, artist, date, time, and Stage/Scene at a different effective Place (city): create is refused.
- Same owner, artist, date, and Stage/Scene, with time missing on one or both sides: the User (and MCP) must choose attach (may then set time on the existing Concert) or create a second Concert.
- Same artist and date with different times: create is allowed without that choice.

### 5.4 Shared List

**Description:** Private until enabled. Pierre sends the URL to a few people. They see what he plans and what he attended. Realizes UJ-4.

**Functional Requirements:**

#### FR-14: Public profile off by default

A User's Shared List is off until they enable it. Event links keep working independently.

**Consequences (testable):**
- With the public profile off, the username URL is not visible.
- Event links still work (FR-18).

#### FR-15: Enable and disable public profile

The owner can expose a Shared List at a URL derived from their unique username or turn it off. There is no searchable User directory.

**Consequences (testable):**
- Enabled Shared List is reachable at its URL without signing in.
- A disabled profile or unknown username is not visible.

#### FR-16: Read-only visitors see going and attended

Visitors browse Events and Concerts with Attendance `going` or `attended`. No edit or write controls on the Shared List page, including when signed in as someone else. Notes and Concerts with no Attendance are omitted. Tapping a grouping opens that Event and follows FR-18 (sign-in if needed, then join).

**Consequences (testable):**
- No create, update, or delete controls on the Shared List page.
- Notes for that User are absent.
- A Concert with no Attendance does not appear.
- A `going` Concert does appear.
- An Event with no visible Concerts does not appear.
- A signed-in visitor who is not the profile User still cannot write on the Shared List page.
- Tapping a grouping opens that Event's URL (FR-18).
- Viewing the Shared List page does not by itself join; join happens when a signed-in User opens that Event, same as any Event link.
- After join, the visitor sees the full Bill (including Concerts the profile User did not mark) and can set only their Attendance.
- Concerts on Events the profile User does not own may appear when that User has `going` or `attended` on them; tapping still opens that Event so the visitor can join it.

### 5.5 Shared Event

**Description:** One Event record can be used by several Users. Discovery in v1 is the Event URL, including from an enabled Shared List. Realizes UJ-4 and UJ-5.

**Functional Requirements:**

#### FR-18: Event link, owner-only Bill

The Event owner can copy an unguessable Event link. A signed-in User who opens it can view the Bill and set only their Attendance. Unsigned visitors must sign in first and then return to that Event. There is no Event search or directory. Joiners cannot edit the Event or Bill and cannot write notes. A joiner can leave. Collaborative Bill editing, link rotation, owner kick, and a joiner roster are deferred.

**Consequences (testable):**
- Opening the link while signed in shows the same Concerts as the Event owner sees.
- After sign-in or register from an Event link, the User lands on that Event and is joined.
- The joiner can set, change, or clear only their Attendance (including one-shot single-night attend-all for themselves).
- The joiner cannot add, edit, move, or delete Concerts, update or delete the Event, or write notes.
- Other Users' Attendance and the owner's notes are not visible.
- The Event appears on the joiner's Concerts after they open the link while signed in, and on Home featured if it is among their next 1–3 upcoming Events.
- The joiner can leave: the Event leaves their Home and Concerts and their Attendance on its Concerts is deleted. The Bill is unchanged for the owner and other joiners.
- Re-opening a link the User already joined is view, not a second join.
- An unknown Event link is not visible.
- Public-profile off does not disable Event links.
- Shared List groupings for visible Events navigate to this Event URL. That is an intended join path, not a leak.
- The Event owner cannot rotate the link, list joiners, or kick a joiner in v1. The link stays valid until the Event is deleted.

### 5.6 Agent access

**Description:** The same Concert and Event rules must be usable by an agent so Pierre can add structured data without typing every row. Mechanism (MCP) is in `addendum.md`. Realizes the agent job in §3.1.

**Functional Requirements:**

#### FR-17: Machine interface with the same rules

An authenticated agent can list, read, create, update, move, and delete Events and Concerts, including Attendance, subject to the same Event-owner vs joiner rights, validation, Concert-identity (FR-13), and deletion rules as the UI.

**Consequences (testable):**
- An agent-created Concert is indistinguishable in the UI from one created in the form (same fields, same rules).
- Agent deletion follows FR-11; moves and updates follow FR-12; Concert-identity outcomes follow FR-13 (attach, refuse, or the same attach-or-create choice as the UI); Event-link joins follow FR-18.
- A joiner's agent cannot edit the Bill.
- An unauthenticated caller cannot write.
- v1 ships a machine interface after the first UI CRUD path works; both are in MVP. The intended interface is MCP — see addendum.

## 6. Non-Goals (Explicit)

- Genre-specific tracker or analytics/KPI dashboard.
- Collaborative Bill editing, household/band/org accounts, or public write access.
- PWA / installable app.
- Import from old LiveMemory databases (enter Concerts in this app; import later).
- Ticket alerts, streaming-taste discovery, crowdsourced setlists, friend feeds, Event search/directory, or public profile growth.
- Photos, ratings, or companion-tracking as first-class v1 fields. `[ASSUMPTION: notes cover personal memory text; no media upload in v1.]`
- A dedicated rapid-add festival page (artist or group + Stage/Scene + time only). Prefill in FR-7 is v1; the specialized page is later.
- AI scan of a running order that fills the Bill, then the User ticks who they saw. Later; v1 Bill is owner-entered (or agent-entered via FR-17), not parsed from a poster.
- A global canonical festival database. Shared Events are link-joined, not a searchable catalog.
- Username rename and migration or redirection of an existing public-profile URL.
- Event-link rotation, owner kick, and a joiner roster. Joiner leave is in v1.
- Joiner notes. v1 notes are Event-owner-only.
- Extra Home stats beyond the v1 three souvenir counts. v1 is attended Concerts, Events owned+joined, and current going. More counts later.

## 7. MVP Scope

Account and unique username at registration; Home (featured + v1 souvenir stats) and Concerts (full log); Event-backed Concert CRUD with optional time and future dates; explicit or transparent Event creation; Event-owner updates and prefill; per-User Attendance (`going` / automatic `attended` / unset Bill-only); Event view as Bill; one-shot single-night attend-all on current Concerts; Event rules; username-derived Shared List; Event link for signed-in joiners with owner-only Bill edits and joiner leave (FR-18); Event-owner notes; machine interface (FR-17) after first UI CRUD.

Out of scope for MVP is everything in §6.

## 8. Success Metrics

Hobby/personal: Pierre can register, sign in, and add a first Concert in under 3 minutes, and he still uses Home / Concerts after a month.

**Primary**
- **SM-1**: First Event-backed Concert created within 3 minutes after registration (including username) and sign-in. Validates FR-1, FR-2.
- **SM-2**: Event date validation blocks 100% of out-of-range Concert saves. Validates FR-12, FR-13.
- **SM-3**: A visitor to an enabled Shared List sees Concerts marked `going` or `attended`, but never edit controls, notes, or Bill-only Concerts on that page. Tapping an Event follows FR-18. Validates FR-16, FR-18.
- **SM-6**: A signed-in joiner can open an Event link and set Attendance, and cannot edit the Bill. Validates FR-18.

**Secondary**
- **SM-4**: At least 90% of Event-based Concert saves in a five-entry usability check succeed on the first try using prefill. Validates FR-7, FR-12.
- **SM-5**: In a five-task usability check, at least four tasks correctly distinguish a Concert from its Event after creating one of each. Validates FR-5, FR-8, FR-9.

**Counter-metrics (do not optimize)**
- **SM-C1**: Public visitor count or “followers.” Counterbalances SM-3.
- **SM-C2**: Treating Home souvenir counts, or raw Concert count, as a score (festival-as-N-shows, or counting Bill-only Concerts as "saw it"). Home may show the three v1 counts; do not optimize them. Counterbalances SM-5.

## 9. Assumptions Index

- Inline from UJ-1 — Browser, not a native app.
- UJ-4 — Visitors arrive from a URL Pierre sends. Confirmed.
- FR-15 — Public profile URL is derived from a unique username; no searchable User directory. Confirmed. Username is chosen at registration (`a-z0-9_-`, case-insensitive unique, immutable in v1). Confirmed 2026-08-17.
- FR-2 — Transparent Event default name is `Concerts on {DD/MM/YYYY} at {Place}`. Confirmed 2026-08-17.
- FR-10 — Attend-all is a one-shot on current Concerts only; no later-added flag. Confirmed 2026-08-17.
- FR-4 — Allowed transitions: past = `attended`|unset; future = `going`|unset; no `attended`→`going`; clear at boundary stays unset. Confirmed 2026-08-17.
- FR-8 — Signed-in IA is Home (featured 1–3 + three souvenir stats) and Concerts (full owned+joined log). Confirmed 2026-08-17 UX reconcile.
- FR-16 — Shared List groupings open that Event (FR-18). The profile page stays read-only; join happens on the Event. After join, the visitor sees the full Bill. Confirmed 2026-08-17.
- FR-3 — Notes are Event-owner-only in v1; joiners have Attendance only. Confirmed 2026-08-17.
- FR-11 — Empty Event can be deleted; last Concert delete/move leaves the Event empty. Confirmed 2026-08-17.
- FR-18 — Joiner can leave (Attendance deleted). No rotate, kick, or roster in v1. Post-auth return to the Event. Confirmed 2026-08-17.
- FR-4 — "Past" uses Europe/Paris; time if set, else end of that calendar date. Confirmed.
- FR-4 — Owner Attendance default applies only to transparent one-Concert create; Concerts added onto an existing Event start unset. Confirmed 2026-08-17 validation update.
- FR-16 / FR-18 — Shared List can open Events that appear there; join is FR-18. Confirmed 2026-08-17.
- §0 — Shipped UI copy is English; `going` label is "Going". Confirmed 2026-08-17 validation update.
- FR-17 — MCP is the intended machine interface; sequenced after first UI CRUD; both in MVP. Confirmed.
- Inline from §6 — No photos, ratings, or companion fields in v1.
- `[ASSUMPTION: v1 is a responsive web app at https://livememory.pierre-reynaud.fr.]`
- `[ASSUMPTION: Place is practical free text.]`
- `[ASSUMPTION: lists of about 1,000 Concerts complete within 2 seconds under normal use.]`
- `[ASSUMPTION: v1 Bill is whatever the owner (or agent) typed; completeness of a real-world festival lineup is not required.]`
- FR-18 — Event discovery is an unguessable link; no search. Confirmed. Event owner alone edits the Bill. Confirmed. Public profile remains. Confirmed.
- `[ASSUMPTION: Event links use an unguessable identifier, not the Event name.]`
