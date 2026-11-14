---
title: 'Quick site remarks: festival dates, day collapse, Save width, copy'
type: 'feature'
created: '2026-11-14'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ab229534f3325de09719d13bd1b5007f0cdf0a01'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Festival date badges show only the start day, multi-day Event bills cannot be folded, the Add sheet Save button is as wide as its label, and two Profile/sheet strings repeat a state the control already shows.

**Approach:** Show a compact range on `AppDateStack` when start and end differ. Collapse festival bill days on the Event page, open by default. Stretch Save to the sheet width on small viewports. Mark Stage or Scene as optional and drop the Shared list On/Off prefixes.

## Boundaries & Constraints

**Always:** English UI copy. Keep the accessible date label as the full civil range (`formatEventDateLabel`); the badge stays `aria-hidden`. Single-night badges stay weekday / day / month. Collapse is a real button with `aria-expanded`; collapsed concerts leave the accessibility tree. Default every day open; state lasts for the visit only. Single-night bills get no collapse control. Do not show a seen count. Stage or Scene stays optional and keeps its label. Shared list behavior is unchanged. Same-day concert rows keep no hairline; the hairline stays above the next day.

**Ask First:** Renaming Stage or Scene to "Venue or stage". Changing stored ArcTanGent dates. Applying seen-by-default only to single nights.

**Never:** Festival preview, seen-only bill filter, sound-wave background, consent-screen redesign, password change, account deletion, username edit, Event-picker redesign, or a new column.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Single date | start = end, or end omitted | Weekday, day, month as today. `range` false | Invalid ISO returns empty weekday/month and the raw day |
| Same-month range | 2026-08-19 to 2026-08-22 | Weekday empty, day `19–22`, month `AUG` | If end < start, render the start as a single day |
| Cross-month range | 2026-08-30 to 2026-09-01 | Weekday `2026`, day `30–1`, month `AUG–SEP` | N/A |
| Cross-year range | 2026-12-30 to 2027-01-01 | Weekday `2026–2027`, day `30–1`, month `DEC–JAN` | N/A |
| Festival bill | Two or more day groups on a festival | Each day header is a button, open, with `N concert(s)`. Click hides that day's rows only | N/A |
| One day | Single night, or one festival day | Day header stays plain text when shown. No collapse button | N/A |
| Shared list off/on | Switch toggled | `Your list is private.` / `Anyone with the link can see your list.` | N/A |

</frozen-after-approval>

## Code Map

- `app/utils/event-dates.ts` -- `formatDateStack` (lines 17–29). Add optional end. En dash matches `formatEventDateRange` in `shared/domain/dates.ts`.
- `app/components/AppDateStack.vue` -- props `date`, optional `endDate`, `size`. Hides an empty weekday. `data-range` when the span is a range.
- `app/assets/css/main.css` -- `.lm-date-stack` is 48px / 60px (`data-size="lg"`). Range badges use `width: auto`, `min-width` of those sizes, and a smaller day so `19–22` and `AUG–SEP` fit.
- `app/components/AppEventCard.vue` -- `stackDate` (lines 49–55) is the concert date when compact, otherwise `event.start_date`. Pass `event.end_date` only for the non-compact stack. `stackDateLabel` already uses `formatEventDateLabel`.
- `app/pages/e/[id].vue` -- header `AppDateStack` at line 224 uses `start_date` only. Bill groups at lines 315–325. `showDayHeaders` uses `shouldShowDayHeaders`. Collapse only when `kind === 'festival'` and `billGroups.length > 1`.
- `app/utils/concert-groups.ts` -- `groupConcertsByDate`, `shouldShowDayHeaders`, `formatConcertDayLabel`. Add `dayConcertCountLabel`.
- `app/components/AppAddConcertSheet.vue` -- Save at line 1010 has `flex-1` inside a row that shrink-wraps. Stage field at line 928 has no description. Footer ui `lm-sheet-foot` at line 632.
- `app/pages/profile.vue` -- Shared list description at line 178.
- `tests/unit/dates-domain.spec.ts`, `tests/unit/event-detail-design.spec.ts`, `tests/unit/add-concert-sheet.spec.ts`, `tests/unit/profile-redesign.spec.ts`, `tests/e2e/profile.spec.ts`.
- UX spine: Event group header is "date or range". Day headers are the bill breaks. Do not add a hairline between same-day rows.

## Tasks & Acceptance

**Execution:**
- [x] `app/utils/event-dates.ts` -- extend `formatDateStack(start, end?)` with the matrix above -- one formatter for every badge.
- [x] `app/components/AppDateStack.vue` and `app/assets/css/main.css` -- accept `endDate`, mark ranges, keep single-day width -- callers stay readable.
- [x] `app/components/AppEventCard.vue` and `app/pages/e/[id].vue` -- pass `end_date` on event-level badges -- list cards and the Event header show the festival span.
- [x] `app/utils/concert-groups.ts` and `app/pages/e/[id].vue` -- festival day buttons, default open, visit-scoped set -- scan a long bill without a seen-count decision.
- [x] `app/components/AppAddConcertSheet.vue` -- `w-full` Save row; stack Save above Delete below `sm`; `description="Optional"` on Stage or Scene -- the label width bug and the mandatory question.
- [x] `app/pages/profile.vue` -- drop `On.` / `Off.` -- the switch already shows the state.
- [x] `tests/unit/dates-domain.spec.ts` and `tests/unit/concert-groups` coverage -- the matrix and the count label.
- [x] `tests/e2e/festival-bill.spec.ts` -- seed a two-day festival, assert the range badge, collapse one day, leave the other visible, and assert the list card range.
- [x] Update profile and sheet unit/e2e expectations that lock the old copy or Save class.

**Acceptance Criteria:**
- Given a festival whose start and end differ, when it renders on the Event page and the Concerts list, then the badge shows the range and the screen-reader date is the full civil range.
- Given a single night, when its badge renders, then it still shows weekday, day, and month.
- Given a festival with concerts on two days, when the Event page opens, then both days are expanded; collapsing one hides only that day's artists and sets `aria-expanded` false.
- Given the Add sheet on a phone-width viewport, when it is open, then Save spans the sheet and Delete or Attach/Create/Cancel stay usable.
- Given Profile, when the shared list is off or on, then the description has no On/Off prefix, and Stage or Scene shows Optional without becoming required.

## Spec Change Log

## Design Notes

Range stack uses the existing three lines. The weekday line carries the year only when the month changes (`2026` or `2026–2027`). Same-month ranges leave that line blank and hide it. The en dash is `–`.

```
19–22
AUG

2026
30–1
AUG–SEP
```

## Verification

**Commands:**
- `pnpm exec vitest run tests/unit/dates-domain.spec.ts tests/unit/event-detail-design.spec.ts tests/unit/add-concert-sheet.spec.ts tests/unit/profile-redesign.spec.ts tests/unit/home-featured.spec.ts` -- expected: pass
- `pnpm exec playwright test tests/e2e/festival-bill.spec.ts tests/e2e/profile.spec.ts` -- expected: pass against local Supabase

## Suggested Review Order

**Festival date range**

- One formatter decides single day versus span, including inverted ends.
  [`event-dates.ts:36`](../../app/utils/event-dates.ts#L36)

- Group cards pass the event end; a one-concert card keeps its own day.
  [`AppEventCard.vue:56`](../../app/components/AppEventCard.vue#L56)

- The Event header badge receives the event end date.
  [`[id].vue:243`](../../app/pages/e/[id].vue#L243)

- Range badges grow past the single-day width and do not wrap.
  [`main.css:175`](../../app/assets/css/main.css#L175)

**Collapsible festival days**

- Only a festival with two or more bill days gets a collapse control.
  [`[id].vue:51`](../../app/pages/e/[id].vue#L51)

- Opening another event clears which days were folded.
  [`[id].vue:127`](../../app/pages/e/[id].vue#L127)

- A folded day stays in the document so aria-controls still resolves.
  [`[id].vue:361`](../../app/pages/e/[id].vue#L361)

**Sheet and Profile copy**

- On a phone Save stacks full width; Delete stays on the next row.
  [`AppAddConcertSheet.vue:1010`](../../app/components/AppAddConcertSheet.vue#L1010)

- Stage or Scene says it is optional without becoming required.
  [`AppAddConcertSheet.vue:932`](../../app/components/AppAddConcertSheet.vue#L932)

- The shared-list switch no longer repeats On or Off.
  [`profile.vue:178`](../../app/pages/profile.vue#L178)
