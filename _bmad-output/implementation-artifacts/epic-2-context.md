# Epic 2 Context: Share a night without giving the Bill away

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Let a User share a night without handing over the Bill. Visitors reach an Event from an unguessable URL or from an opt-in username Shared List, then join, set only their Attendance, and leave. Notes, Bill-only rows, and write controls stay with the Event owner. Event links work even when the public profile is off. Joiner-impact confirms for Concert delete, Concert move, and Event delete land once membership exists.

## Stories

- Story 2.1: Join an Event via its URL
- Story 2.2: Set my own Attendance as a joiner
- Story 2.3: Leave an Event
- Story 2.4: Enable and disable my Shared List
- Story 2.5: Browse a Shared List and open an Event to join
- Story 2.6: Confirm when joiners would lose a Concert or Event

## Requirements & Constraints

- Public profile is off until enabled. Disabled and unknown usernames are the same quiet not-found. Enabled-but-empty is a visible empty list ("Nothing to show yet.") with no Add CTA. v1 has no User directory or Event search.
- Shared List shows that User's effective Going and Attended Concerts, grouped by Event. Notes, unset Attendance, empty Events, and write controls are omitted — including when the visitor is signed in as someone else.
- Tapping a grouping opens that Event URL. Viewing the Shared List does not join. Join is the signed-in Event URL flow. After join, the visitor sees the full Bill and can set only their Attendance. Concerts on Events the profile User joined (not only owned) may appear when they have Going or Attended.
- Notes are Event-owner SELECT only. Nobody SELECTs another User's Attendance. Unauthenticated SELECT is only the kernel public Shared List surface. `service_role` is forbidden for domain tables. Auth redirect excludes `/`, `/login`, `/confirm`, `/u/**`.
- Hard product rules live in Postgres. Domain turns failures into English messages that name the rule. Pages call Pinia stores; stores call `shared/domain` with a user-scoped client (anon is OK for the public view). Auto-imports off. Tests in `tests/unit` and/or `tests/e2e` (Playwright against local Supabase only). UI copy English. Dark-only.

## Technical Decisions

- One isomorphic domain module takes a user-scoped Supabase client so RLS applies. Pinia and pages must not query domain tables. Shared List may SELECT only the kernel public view (or an equivalent username lookup RPC). SQL RPC is not the default elsewhere.
- Effective Attendance is defined once in SQL: stored `going` that is past in Europe/Paris reads as `attended`. Shared List must use that definition, not the raw column.
- Username lookup must not become a listable directory: do not `GRANT SELECT` on a view of all enabled usernames or of all public concerts. Follow a single-username lookup.
- Event path is `/e/:id` (UUID). Join inserts `event_members`; the owner is never stored there. Leave deletes membership and that User's Attendance on that Event's Concerts.
- Schema changes are migrations; commit generated `app/types/database.types.ts`.

## UX & Interaction Patterns

- Shared List uses the same dark chrome. Compact card for one visible Concert; Event group for two+. No Attendance chips or Add/Edit/Delete on that page. Empty sharing-on copy is "Nothing to show yet." Disabled/unknown is "Not found."
- Screen reader announces "Shared list for {username}" and does not announce missing notes or bill-only Concerts.
- Tapping a grouping is the join path: sign in if needed, then the existing Event page.

## Cross-Story Dependencies

- 2.5 extends the 2.4 public shell (`/u/:username`, enable flag, not-found) and reuses 2.1 join plus 2.2 joiner Bill/Attendance. Do not implement 2.6 owner joiner-impact confirms here.
- Epic 1 list grouping (Event group / compact) and Attendance chips stay the signed-in log; Shared List reuses grouping and omits chips.
