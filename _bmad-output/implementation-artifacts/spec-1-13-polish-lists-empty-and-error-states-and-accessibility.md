---
title: 'Story 1.13: Polish lists, empty and error states, and accessibility'
type: 'feature'
created: '2026-08-19'
status: 'in-progress'
baseline_commit: '201a83ef0bf9653e9365e2224cb4a714cc52a3e2'
review_loop_iteration: 0
context:
  - docs/project-context.md
  - _bmad-output/implementation-artifacts/epic-1-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Home, Concerts, and Event still flash raw loading text, show raw fetch errors on Concerts, mount the full Event-group DOM, and skip route announcements, offline write blocking, and reduced-motion chrome.

**Approach:** Cold loads use `USkeleton`. Fetch failures use "Couldn't load." + Retry. Concerts windows Event groups with a muted "Loading more" row (no infinite scroll). Offline writes toast and stop. Route changes announce surfaces; focus rings stay visible on black; reduced motion drops glow and blur animation.

## Boundaries & Constraints

**Always:**
- Pages do not fetch remote domain data. Pinia + `shared/domain` with a user-scoped client. No `service_role`.
- Auto-imports off. Vue from `vue`, Nuxt from `#imports`.
- Set-based concert reads (not per-Event round trips). Window Concerts by Event groups (~20). English copy. Dark-only.
- Tests in `tests/unit` and/or `tests/e2e`. Playwright → local Supabase only.

**Ask First:**
- New SQL RPC or infinite-scroll observers.
- Changing empty-state copy already shipped ("Nothing upcoming.", "No shows yet.", "No concerts on this bill.").

**Never:**
- Epic 2 (join, Shared List, Leave Event) or Epic 3 (MCP).
- Offline write queue / PWA. Drag-and-drop line-up. Hover-only actions on `< md`. Modal stacks deeper than one.
- Edits to `_bmad-output/implementation-artifacts/sprint-status.yaml`. PR targeting `main`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold Home | `loading` true, no error | `USkeleton` matching featured + stats; no empty/error copy | N/A |
| Cold Concerts | `loading` true, no events | `USkeleton` matching groups | N/A |
| Cold Event | Event not resolved | `USkeleton` matching groups; no "Loading event…" | N/A |
| Fetch fail | Home/Concerts/Event list error | "Couldn't load." + Retry; no empty substitute | Retry re-runs the store fetch |
| Concerts window | More Events than `EVENTS_LIST_WINDOW` | First window rendered; next page is an explicit Load more, not scroll | Muted "Loading more" while `loadingMore` |
| Offline write | `navigator.onLine === false` | Toast; mutation does not call domain | No queued retry |
| Route change | `/home`, `/concerts`, `/e/:id`, `/profile` | Live region "Home" / "Concerts" / "Event: {name}" / "Profile" | Event waits for name when known |
| Reduced motion | `prefers-reduced-motion: reduce` | No Going-chip glow; glass/sheet blur is not animated; outlines remain | N/A |

</frozen-after-approval>

## Code Map

- `shared/domain/concerts.ts` -- Export `EVENTS_LIST_WINDOW` (20). Add `listConcertsForEventIds(client, ids)` via `.in('event_id', ids).order('date')` (set-based). Extend `TableApi.select` with `in`. Keep `listOwnedConcerts` for post-mutation reload.
- `app/stores/events.ts` -- Cold `fetchEvents` loads all Events + concerts for the first window. `loadMoreEvents` fetches the next Event-id slice and merges. `loadingMore` + `hasMoreEvents` + `visibleEvents`. Write actions call `canWriteOnline()`; if offline, toast `You're offline.` and return `{ data: null, error }` without domain. Pages never `from('concerts')`.
- `app/utils/online-write.ts` -- `OFFLINE_TOAST_TITLE`, `canWriteOnline()`.
- `app/utils/surface-name.ts` -- Path → "Home" / "Concerts" / "Event: {name}" / "Profile".
- `app/components/AppListSkeleton.vue` -- `USkeleton` variants `home` | `groups`.
- `app/components/AppLoadError.vue` -- "Couldn't load." + Retry.
- `app/components/AppRouteAnnouncer.vue` -- `aria-live="polite"` in `app/app.vue`.
- `app/pages/home.vue` -- No blocking await; skeleton / error / content. Stats hidden until loaded.
- `app/pages/concerts.vue` -- Same error copy as Home; windowed `visibleEvents`; Load more + "Loading more"; no `IntersectionObserver`.
- `app/pages/e/[id].vue` -- Skeleton while unresolved; keep Event not-found.
- `app/assets/css/main.css` -- Visible `:focus-visible` on black; `prefers-reduced-motion` kills transitions/animations on glass.
- `app/components/AppAttendanceChip.vue` -- Already drops glow via `motion-reduce`; keep outline.
- `app/stores/add-concert-sheet.ts` / `app/stores/edit-event-sheet.ts` -- Opening one closes the other (one-level modal).
- `tests/unit/polish-lists.spec.ts` -- Source-guards for skeleton, error, window, announcer, offline, reduced motion, no hover-only / no DnD / one sheet.
- `tests/unit/concerts-domain.spec.ts` -- `listConcertsForEventIds` + `in` mock.
- `tests/e2e/polish-lists.spec.ts` -- Announcer, Home fetch error + Retry, offline write toast.
- Read-only: `mockups/key-concerts.html`, `key-event.html`, `key-add-sheet.html` (spines win); `app/components/AppEventCard.vue`.

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/polish-lists.spec.ts` -- Red source-guards for ACs
- [x] `tests/unit/concerts-domain.spec.ts` -- Red `listConcertsForEventIds` window query
- [x] `tests/e2e/polish-lists.spec.ts` -- Red announcer, error+Retry, offline toast
- [x] Domain + store windowing, offline guard, pages/skeletons/announcer/a11y CSS
- [x] One-level modal: opening Add closes Edit Event and the reverse

**Acceptance Criteria:**
- Given a cold load of Home, Concerts, or Event, when data is not ready, then `USkeleton` matches featured+stats or groups.
- Given a fetch fails, when I am on Home, Concerts, or Event, then I see "Couldn't load." with Retry.
- Given about 1,000 Concerts, when I open Concerts, then the list windows (no infinite scroll) and a muted "Loading more" row appears while the next page fetches.
- Given I am offline, when I try to write, then a toast is shown and the write is blocked; no offline queue.
- Given I use a keyboard and screen reader, when I change routes, then the surface is announced, focus rings stay visible on black, and reduced motion drops blur animation and Going-chip glow but keeps outlines.
- Given list and Event composition, when compared with the key mockups, then spines win; no hover-only actions on `< md`; no drag-and-drop line-up; modal stack is one level.

## Spec Change Log

## Design Notes

Window Events, not a flat Concert list, so empty owned Events stay honest and grouping does not split. First window is upcoming-first (`sortEventsForConcerts`). Load more is a button, never an intersection observer.

```ts
await client.from('concerts').select('*').in('event_id', ids).order('date', { ascending: true })
```

## Verification

**Commands:**
- `pnpm lint` -- expected: no errors
- `pnpm typecheck` -- expected: no errors
- `pnpm test:unit` -- expected: pass, including polish-lists
- `pnpm test:e2e tests/e2e/polish-lists.spec.ts` -- expected: pass against local Supabase when Docker is up
