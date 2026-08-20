# Epic 2 Context: Share a night without giving the Bill away

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Pierre can send an Event URL (or later a Shared List). A signed-in joiner sees the shared Bill, sets only their Attendance, and can leave. They never edit the Bill, write notes, or see other Users' Attendance. Event links work with the public profile off. Joined Events use Epic 1 Home featured and Concerts list rules.

## Stories

- Story 2.1: Join an Event via its URL
- Story 2.2: Set my own Attendance as a joiner
- Story 2.3: Leave an Event
- Story 2.4: Enable and disable my Shared List
- Story 2.5: Visit a Shared List
- Story 2.6: Confirm joiner impact before Bill-destroying edits

## Requirements & Constraints

- Membership is `event_members (event_id, user_id)`. The owner lives on `events.owner_id` and is never stored as a member. Join inserts the row; leave deletes that row and that User's Attendance on that Event's Concerts. Opening the Event URL while signed in joins again.
- Only the Event owner edits the Event and Bill. Joiners set or clear only their Attendance. Notes are owner-only. Nobody sees another User's Attendance.
- Leave is a joiner action with confirm. The Bill stays for the owner and other joiners. Owners do not Leave.
- Hard rules live in Postgres (RLS, FKs, triggers). Domain uses a user-scoped client. No `service_role` on domain tables. Pages call Pinia; Pinia calls `shared/domain`.
- Auto-imports off. English UI. Playwright against local Supabase only. Every story adds or updates tests.

## Technical Decisions

- Layers: pages/components → Pinia → `shared/domain` → user-scoped Supabase. SQL RPC is not the default.
- Event URL is `/e/:id`. Unknown Event is quiet not-found. After leave, the joiner can no longer SELECT that Event until they open the URL again (join).
- Attendance DELETE is visibility-gated on Concerts. Leave must not leave orphan Attendance if membership is removed via the Data API.

## UX & Interaction Patterns

- Joiner Event matches owner Event minus write controls, plus **Leave Event**.
- Leave is a quiet text/ghost control, never `{components.button-primary}`. Confirm copy is exact: "Leave this Event? It will leave your list. The bill stays for the owner." Destructive color is only on the confirm action.
- Modal stack stays one level. After leave, Concerts no longer lists that Event.

## Cross-Story Dependencies

- 2.1 ships join, membership SELECT, and owned+joined lists. 2.2 ships joiner Attendance. 2.3 is leave only. Shared List is 2.4–2.5. Joiner-named delete/move confirms are 2.6.
