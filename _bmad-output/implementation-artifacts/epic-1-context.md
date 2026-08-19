# Epic 1 Context: Keep a private log of nights

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Pierre registers, signs in, and keeps a private Event-backed log of single-night shows and festivals: Concerts, per-user Attendance, owner notes, Home (featured plus three souvenir stats), and Concerts (full owned log). LiveMemory is usable alone, with no sharing required. Built on the existing Nuxt/Supabase factory.

## Stories

- Story 1.1: Register with username and land on a branded Home
- Story 1.2: See Home featured Events and souvenir stats
- Story 1.3: See Concerts as grouped Events
- Story 1.4: Create a festival or night before its Concerts
- Story 1.5: Add a Concert from Home or Concerts
- Story 1.6: Add a Concert onto an owned Event
- Story 1.7: Record Attendance and owner notes
- Story 1.8: Edit Concerts, write notes, and delete Concerts
- Story 1.9: Update Event rules without breaking the Bill
- Story 1.10: Move a Concert between owned Events
- Story 1.11: Delete an Event
- Story 1.12: Attend this night
- Story 1.13: Polish lists, empty and error states, and accessibility

## Requirements & Constraints

- Owner-only Event and Bill writes. Joiners cannot create, update, move, or delete Concerts or Events, or write notes.
- Every Concert belongs to exactly one Event (`event_id` NOT NULL). Empty Events are allowed; deleting or moving the last Concert leaves the Event empty.
- Empty Event delete is owner-only with no Concert warning; `/e/:id` becomes the same quiet not-found as an unknown Event. Non-empty Event delete requires explicit confirm that the Event and all Concerts are deleted (Attendance and notes go with Concerts). No keep-standalone Concerts. Joiner-named confirm copy is Epic 2 Story 2.6.
- Hard rules live in Postgres (RLS, FKs, checks). Domain turns failures into English messages that name the failed rule. `service_role` is forbidden on domain tables. Pages call Pinia; Pinia calls `shared/domain` with a user-scoped client.
- Auto-imports off. English UI copy. Playwright against local Supabase only. Every story adds or updates tests.

## Technical Decisions

- Layers: pages/components → Pinia stores → `shared/domain` → user-scoped Supabase (RLS). Nitro `server/api` is personal-key and signup only.
- Event URL is `/e/:id` (UUID). Unknown Event, unknown username, and sharing-off share a quiet not-found.
- Concerts cascade on Event delete; Attendance cascades on Concert delete. Notes are an owner column on Concerts.
- Owner Event DELETE RLS already exists so a failed follow-on Concert insert can roll back a New night/New festival Event. Product Event-delete UI is this story.

## UX & Interaction Patterns

- Owner Event has Edit Event. Delete Event is owner-only (hidden for joiners, not disabled).
- Non-empty delete confirm lives in the same glass sheet as Edit (modal stack is one level). Empty delete does not use the Concert-destruction warning.
- Unknown Event copy is quiet: "Event not found." Destructive actions use error color, not a second accent.

## Cross-Story Dependencies

- Stories 1.1–1.10 ship owner CRUD, Event rules, Concert delete, and Concert move. This story is Event delete only. Leave Event and joiner-impact confirms land in Epic 2. MCP Event delete is Epic 3 and must reuse the same domain rules.
