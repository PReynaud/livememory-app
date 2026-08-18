# Entities

Load-bearing product nouns for LiveMemory. Downstream skills must keep this distinction: a **Concert** is one performance on an Event's Bill; **Attendance** is per User on that Concert.

## User

A person with an account and a unique username chosen at registration. Owns Events they create. Chooses whether their username-derived public profile is enabled.

## Event owner

The User who created the Event. Only this User can edit or delete the Event and its Bill in v1. Only this User can write notes on its Concerts.

## Home

Default signed-in landing. Featured upcoming Events (owned and joined, next 1–3 by start date), then three souvenir stats. Not the full log.

## Concerts

The signed-in User's full Event log: Events they own (including empty) and Events they have joined, grouped, upcoming then past.

## Concert

One artist or group performing on a date, with an optional time. Belongs to exactly one Event. Optional Stage/Scene. Attendance is per User. Notes are Event-owner-only in v1. On create, identity is the Event owner's journal (artist case-insensitive + date + clock time): an exact timed match attaches to the existing Concert; the same identity at a different effective Place is refused; missing time on either side asks attach (may then set time) or create a second Concert.

## Event

A grouping of related Concerts: `single_night` or `festival`. One shared record. Has a name, date or date range, Place, optional Stage/Scene list, optional per-Concert Place override, and an unguessable Event URL. May exist with zero Concerts. A one-performer show is an Event with one Concert. Festivals span days; single-night Events use the same start and end date. Transparent create defaults the name to `Concerts on {DD/MM/YYYY} at {Place}`.

## Place

Where an Event or Concert happened (venue, city, festival site, or combination). Inherited from the Event unless that Event allows overrides. Effective Place is that resolved Concert location (Event Place, or the Concert override when allowed).

## Stage or Scene

A named performance area on an Event, mainly for festivals. An empty list means Stage/Scene is not required.

## Attendance

Optional per-User state on a Concert: `going` (shipped label "Going") or `attended`. Unset means Bill-only for that User. A `going` Concert becomes `attended` after its optional time, or after Europe/Paris end-of-day when no time is set. On a `single_night` Event a User may one-shot mark Attendance on Concerts currently on the Bill; later-added Concerts start unset. Festivals have no attend-all.

## Bill

The Event-owner-entered set of Concerts belonging to an Event. Shared with joiners. It is not a canonical or crowdsourced festival lineup.

## Event link

Unguessable URL for one Event (the Event page URL). A signed-in User who opens it can view the Bill and set their own Attendance. Also reached by tapping an Event on an enabled Shared List. A joiner can leave. v1 has no Event search. Unsigned visitors must sign in first.

## Shared List

Read-only public profile at a User's username-derived URL when that User enables it. Shows that User's `going` and `attended` Concerts grouped by Event. Omits private notes, Concerts with unset Attendance for that User, and Events with no visible Concerts. Tapping a grouping opens that Event so the visitor can join. The Shared List page itself has no write controls.
