---
title: LiveMemory PRD addendum
status: final
created: 2026-08-17
updated: 2026-08-17
---

# Addendum

This addendum contains binding implementation constraints and informational research context that do not belong in the PRD narrative. Product behavior remains authoritative in the aligned SPEC and PRD.

## Contract alignment (2026-08-17)

`spec-livememory` and this PRD are aligned on the kernel (SPEC refreshed 2026-08-17): every Concert belongs to exactly one shared Event; Attendance is per User; notes are Event-owner-only; unset means Bill-only; only the Event owner edits the Bill; joiners arrive via Event URL or by opening an Event from the Shared List; they can leave. There is no `skipped` Attendance value and no standalone Concert. Signed-in IA is Home + Concerts. Attend-all is a one-shot on current `single_night` Concerts. Username is chosen at registration.

## Machine interface (MCP)

Pierre wants an MCP interface exposed early so an agent can create and update Events and Concerts, including by extracting data from screenshots outside LiveMemory. That is FR-17. This addendum names the mechanism: an MCP interface authenticated as the acting User (Event owner or joiner, same rights as the UI) and subject to the same validation as the UI. Not a second product. Not a substitute for the first UI CRUD path.

Rejected alternative: treat the Event as only "Concerts I saw." Pierre wants the Event view to show the whole owner-entered bill, then Attendance. Canonical/scraped festival databases remain out of v1.

## Timezone for auto-attended

FR-4: Europe/Paris, confirmed. If time is set, "past" is after that local time; if not, after the end of that local calendar date. Auto-`attended` applies only to Concerts that were `going`, not to Bill-only rows.

## Factory stack (binding, not product features)

Nuxt 4, Nuxt UI, Pinia for remote data, SQL migrations with RLS, no Prisma, no PWA. Playwright targets local Supabase only. Every story adds or updates tests. Production URL `https://livememory.pierre-reynaud.fr`; GitHub repo slug `livememory-app`.

## Landscape extract (2026-08-17)

Informational only. Not requirements. Source: Discovery research digest. Facts and positioning only. Do not treat as MVP cuts.

### Comparables vs a private personal log

- **Setlist.fm** — Crowdsourced public wiki of what was played. “I was there” attaches a user to a shared setlist; festival attendance is per setlist, not a grouped personal night. Optimizes for canonical setlists, not a private journal.
- **Songkick** — Current consumer app is upcoming shows, artist tracking, ticket options. Older gigography still exists in APIs; north star is discovery. Sold by WMG to Suno (Nov 2025).
- **Bandsintown** — Discovery, streaming-library sync, tour alerts, tickets. Optimizes for “never miss a show,” not a personal archive.
- **Concert Archives** — Social network + global concert database + diary. Optimizes for a shared historical record with a personal layer on top.
- **Last.fm** — Core product is scrobbling listening. Events exist on profiles; event history is not in the public API. Listening is not attendance.
- **Personal journals** — Gigvault, Concerts Remembered, Mosh, SetSeen, Concert Board; local/no-account apps (Rail, NEXFES). Spreadsheets remain a named fallback.

### Gaps people name

- Privacy: wiki/social products treat attendance as public or leaky. Newer diaries advertise private-by-default.
- Grouping nights/festivals: festival “I was there” is often marking each set; some journals still lack festival support.
- Ownership of history: weak first-party export on incumbents; discovery platforms change owners.
- Notes: rating/companion/memory fields are absent on Setlist.fm and Songkick attended.

### Traps if copying social/discovery

- Ticket/alert funnels and streaming-taste proxies as the object of the product.
- Public attendance, feeds, friend-matching, badges as growth.
- Crowdsourced canonical data as source of truth.
- Festival-as-N-shows inflating concert counts.
- Treating user history as industry behavioral data.

### URLs

- https://www.setlist.fm/faq
- https://apps.apple.com/us/app/concert-archives/id1531993239
- https://apps.apple.com/us/app/songkick-concerts/id438690886
- https://apps.apple.com/us/app/bandsintown-concerts/id471394851
- https://wire.extrachill.com/festival-wire/setseen-wants-to-be-a-letterboxd-style-log-for-concerts-and-festivals-and-people-are-debating-the-value/
- https://concertboard.com/about
