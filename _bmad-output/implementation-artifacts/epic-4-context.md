# Epic 4 Context: Live Pulse visual pass

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Restyle the screens LiveMemory already has toward the Live Pulse board so the next concert feels present and past concerts are easy to scan. Design only: the same data, stores, routes, and owner / joiner rules as Epics 1–3.

## Stories

- Story 4.1: Move the app onto Live Pulse tokens
- Story 4.2: Lead Home with the next concert
- Story 4.3: Group the Concerts list by year
- Story 4.4: Give the Event page a display header and my notes
- Story 4.5: Restyle the Add and Edit sheets
- Story 4.6: Recolor the app chrome

## Requirements & Constraints

- Palette: canvas `#081020`, surfaces `#111827` / `#1F2937`, border `#263042`, text `#F9FAFB`, muted `#9CA3AF`, pink `#FF4D8A` for Going and primary meaning, cyan `#00D4FF` for focus and active chrome only. Violet only inside the Home hero gradient.
- Pink text and cyan focus must pass WCAG AA on the canvas; reduced motion removes the hero atmosphere.
- Long artist names, empty journal, loading, and error states must read on a 390px phone.
- Primary buttons stay 44px outline. No glow except the existing Going chip glow.
- Notes stay owner-only (they live in `concert_notes`, unreadable to joiners). Joiner Attendance stays private.
- No screen implies tickets, photos, friends, favorites, setlists, genres, or a statistics dashboard. Nav keeps Home, Concerts, Add, Profile.

## Technical Decisions

- Tokens live in `app/assets/css/main.css` as CSS variables; components reference `var(--…)` rather than hex neutrals. Pink literals `#FF4D8A` stay where tests and Nuxt UI already expect them.
- Date stacks come from one pure util in `app/utils/event-dates.ts`; year grouping from a pure util in `app/utils/concert-list-filters.ts`. Both are unit-tested.
- Unit tests in this repo assert on component source strings (`readFileSync`); new visual rules follow the same pattern. Behaviour is covered by Playwright against local Supabase.
- No new store, schema, migration, or API.

## UX & Interaction Patterns

- Home: hero (first upcoming) → other upcoming → last night memory → souvenirs card.
- Concerts: tabs + filters → year heading → Event rows with date stack.
- Event: kind eyebrow → date stack + title + actions → place → bill → owner notes → owner CTA or joiner leave.

## Cross-Story Dependencies

- 4.2 and 4.4 share the date-stack util and `.lm-date-stack` styles introduced in 4.2.
- 4.3 reuses the date stack from 4.2.
- 4.6 consumes `--focus` from 4.1.
