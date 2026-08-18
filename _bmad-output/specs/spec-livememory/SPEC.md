---
id: SPEC-livememory
companions:
  - entities.md
  - ../../planning-artifacts/ux-designs/ux-livememory-2026-08-15/EXPERIENCE.md
  - ../../planning-artifacts/ux-designs/ux-livememory-2026-08-15/DESIGN.md
sources:
  - ../../planning-artifacts/prds/prd-livememory-2026-08-17/prd.md
  - ../../planning-artifacts/prds/prd-livememory-2026-08-17/addendum.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# LiveMemory

## Why

A music fan needs one private record of the shows they plan to attend and attended, grouped as the nights and festivals actually happened. Each Event has one shared Bill; each User has their own Attendance on that Bill. The Event owner may send an Event URL, or expose a public profile from which visitors can open an Event and join, without giving anyone Bill write access.

## Capabilities

- **CAP-1**
  - **intent:** A music fan can register (email, password, unique username), sign in and out, and create, view, update, and delete Events they own and Concerts on those Events so a lasting personal history exists.
  - **success:** After register and sign-in the User lands on Home; adding a Concert to an owned Event persists after sign-out and sign-in; a timed identity match in the owner's journal attaches to the existing Concert instead of inserting a second row; other Users do not see it unless they open that Event (Event URL or Shared List tap).
- **CAP-2**
  - **intent:** A user can manage Events as groups of Concerts (single-night lineups or multi-day festivals), create an Event before its Concerts or transparently with the first Concert, and use Event data to prefill later entries.
  - **success:** Every Concert belongs to exactly one Event; Concerts lists owned and joined Events grouped (festivals by day); Home shows the next 1–3 upcoming plus three souvenir stats; transparent create names the Event `Concerts on {DD/MM/YYYY} at {Place}`.
- **CAP-3**
  - **intent:** Event dates, Place, optional Stages/Scenes, and Place-override policy constrain Concert entry and Event updates so grouped history stays consistent.
  - **success:** An invalid Concert or incompatible Event update is blocked; the message names the failed rule and affected Concerts; Event start and end dates are inclusive; the owner can save Event dates and Concert dates together so a range correction cannot deadlock.
- **CAP-4**
  - **intent:** The owner can expose a read-only public profile at a username-derived URL, or keep it private. Visitors may open a visible Event from it and join.
  - **success:** The Shared List page shows only `going` or `attended` Concerts, with no notes, Bill-only rows, empty Events, or write controls; tapping a grouping opens that Event (CAP-7); viewing the page alone does not join.
- **CAP-5**
  - **intent:** A User can plan future Concerts, record Attendance, and mark every Concert currently on a single-night Bill in one action.
  - **success:** `going` becomes `attended` after optional time or Europe/Paris end-of-day; unset stays Bill-only; owner default `going`/`attended` applies only to transparent one-Concert create; attend-all is a one-shot on current `single_night` Concerts; past allows `attended` or unset, future allows `going` or unset.
- **CAP-6**
  - **intent:** An authenticated agent can read and manipulate the same Events, Concerts, and Attendance as the UI under the same product rules.
  - **success:** After UI CRUD exists, MCP operations produce the same records, validation, Concert-identity outcomes (attach, refuse, or the same attach-or-create choice), and access control as the acting User's UI rights; unauthenticated callers cannot write.
- **CAP-7**
  - **intent:** A signed-in User can open an Event (via its URL or from a Shared List), see the shared Bill, record their own Attendance, and leave, without editing the Event or Bill.
  - **success:** The joiner sees the same Concerts as the Event owner, can set or clear only their Attendance (including one-shot soirée attend-all), cannot add/edit/delete Concerts or the Event, cannot write notes, does not see other Users' Attendance or owner notes, can leave (Event leaves Home and Concerts; their Attendance is deleted), and is not auto-joined when the owner moves a Concert to another Event.

## Constraints

- Unique username is required at registration (`a-z0-9_-`, case-insensitive unique, immutable in v1). Collision copy: "This username is taken".
- After sign-in the User lands on Home. Concerts is the full owned+joined log (empty owned Events included). Home featured is the next 1–3 upcoming Events plus three souvenir counts (attended Concerts, Events owned+joined, current going). Extra counts are later.
- Shipped UI copy is English. Attendance `going` label is "Going".
- The public profile is private until enabled. The Shared List page is read-only. Tapping a visible Event opens that Event (CAP-7). Event URLs work with the public profile off.
- First version is individual accounts only (no household, band, or org accounts).
- One Event record is shared. Only the Event owner can create, update, move, or delete the Event and its Bill. Collaborative Bill editing is deferred.
- Other Users find a shared Event via its unguessable URL or by opening it from an enabled Shared List. v1 has no Event search or directory.
- Attendance is per User. Notes are Event-owner-only in v1. Joiners have no notes field. Nobody sees another User's Attendance or notes.
- An unsigned visitor hitting an Event URL must sign in, then land on that Event and join.
- Every Concert belongs to exactly one Event. A one-performer show is an Event with one Concert; Events may exist with no Concerts. Deleting or moving the last Concert leaves the Event empty; the owner can then delete it.
- Event Place is inherited by default; an Event may opt in to per-Concert Place overrides.
- An Event with no Stage/Scene list allows Concerts without a Stage/Scene. A defined list restricts selection to those names.
- Event edits that would invalidate existing Concerts are blocked and list the conflicts unless the owner saves Event dates and Concert dates together.
- Concert create identity is the Event owner's journal, not all Users. Artist match is case-insensitive. Same owner + artist + date + clock time: do not insert; attach to the existing Concert (do not move it to another Event). Event and Stage/Scene are not part of the identity key: a timed match on another owned Event still attaches without reparenting; the same timed match on a different Stage/Scene still attaches. Same identity at a different effective Place: refuse. Same owner + artist + date with time missing on one or both: ask attach (may then set time on the existing Concert) or create a second Concert; UI and MCP must offer the same choice. Same artist + date + different times: allowed without asking. Moving a Concert between Events is a separate owner operation, not create/attach.
- Deleting a non-empty Event is owner-only, requires explicit confirmation naming joiner impact, deletes its Concerts and Attendance, and removes the Event for every joiner. Concerts are never kept standalone. Empty Events are owner-deletable without the Concert warning; the Event URL becomes unknown.
- Moving a Concert does not auto-join source joiners to the target. Attendance follows the Concert id and remains visible only where that User may view the Concert.
- Attendance is `going`, `attended`, or unset (Bill-only). There is no skipped value. Past: `attended` or unset (`going` on a past Concert stores `attended`). Future: `going` or unset (`attended` on a future Concert is rejected). `attended` cannot become `going`. Clear at the past boundary stays unset.
- A single-night attend-all action is per User and updates only Concerts currently on that Bill. Festivals have no attend-all.
- MCP authenticates as the acting User and follows UI validation and access rules. Screenshot or running-order interpretation happens outside LiveMemory.
- Factory stack is binding: Nuxt 4, Nuxt UI, Pinia for remote data, SQL migrations with RLS, no Prisma, no PWA. Playwright targets local Supabase only. Every story adds or updates tests.
- Personal lists of about 1,000 concerts must remain usable (target: complete list within 2 seconds under normal use).
- Validation copy must name the failed rule (dates, stage, required fields, ownership, or Concert identity).

## Non-goals

- Genre-specific tracker or an analytics/KPI dashboard. Home souvenir counts are not a dashboard.
- Extra Home stats beyond the three v1 counts.
- Collaborative Bill editing, household/band/org accounts, or public write access on the Bill.
- PWA / installable app.
- Import from old LiveMemory databases.
- A global canonical festival database, Event search/directory, dedicated rapid-add festival page, or built-in AI running-order scan.
- Ticket alerts, discovery feeds, crowdsourced setlists, ratings, photos, or seeing other Users' Attendance.
- Username rename and public-profile URL migration.
- Event-link rotation, owner kick, and a joiner roster. Joiner leave is in v1.
- Joiner notes.

## Success signal

A new user can register with a unique username, sign in, land on Home, and add a first Event-backed Concert in under 3 minutes, including through transparent Event creation. Event validation blocks 100% of invalid Concert saves and incompatible Event updates. `going` transitions to `attended` after the Europe/Paris boundary. A signed-in joiner can open an Event URL (or tap an Event on a Shared List), set Attendance, and leave, without editing the Bill. The Shared List page shows only that User's `going` or `attended` Concerts and has no write controls.

## Assumptions

- Place is a practical free-text location (venue, city, festival site, or a combination).
- Production URL is `https://livememory.pierre-reynaud.fr`; the GitHub repo slug stays `livememory-app`.
- Username rename and public-profile URL migration remain deferred beyond v1.
