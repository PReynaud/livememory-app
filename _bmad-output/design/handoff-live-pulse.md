# Handoff — Live Pulse visual pass (Epic 4)

**Status:** approved for implementation (scope confirmed 2026-11-13: design only)
**Source:** Notion [Design & Explorations](https://app.notion.com/p/Design-Explorations-3f602994851f81e9acd8d42f465b9d20), section "Evolution plan — current app toward Live Pulse", and the Live Pulse board image attached there.
**Design system:** `_bmad-output/planning-artifacts/ux-designs/ux-livememory-2026-08-15/DESIGN.md` (updated for Epic 4).

## Tokens

| Role | Token | Value | Notes |
|---|---|---|---|
| Canvas | `--bg`, `--ui-bg` | `#081020` | Replaces true black |
| Card surface | `--surface` | `#111827` | Event cards, stats, sheets |
| Well / row | `--surface-alt` | `#1F2937` | Date stacks, wells |
| Border | `--border` | `#263042` | Card and chip outlines |
| Foreground | `--fg` | `#F9FAFB` | Titles, artist |
| Muted | `--muted` | `#9CA3AF` | Meta, Attended, unset |
| Going / primary | `going-500`, `--ui-primary` | `#FF4D8A` | Unchanged; all Going meaning |
| Focus / active | `--focus` | `#00D4FF` | Focus ring, active nav, selected tab only |
| Atmosphere stop | — | `#A78BFA` | Home hero gradient only, never a component colour |

Contrast is enforced by `tests/unit/design-tokens.spec.ts`.

## Per-pass rules

1. **Tokens** — `main.css` only plus hard-coded neutrals. Cyan on `:focus-visible` and the selected `.lm-list-tab`. Pink stays on Going chips, filter chips, choice chips, and outline CTAs.
2. **Home** — First upcoming Event becomes a hero: date stack (weekday / day / month), display title, place with a pin, Attendance chip, CSS atmosphere layer (`aria-hidden`, hidden under reduced motion). Last night is a quiet memory card. Stats stay one horizontal card.
3. **Concerts** — Year headings over the listed Events (after pagination). Each Event row is led by a compact date stack. Tabs and filters unchanged.
4. **Event** — Display header with date stack, title, place. Single-night Going chip in the header. Owner-only notes.
5. **Sheets** — Navy glass, cyan focus, same fields and Event picker. Primary stays a 44px outline.
6. **Chrome** — Active nav cyan with `aria-current="page"`, Add is a pink outline circle, equalizer wordmark. Same four targets.

## Held (do not draw)

Friends, tickets, photos, Setlist / Details / Memories tabs, favorites, genre chips, trend stats, discovery search, MCP or Settings in primary navigation, filled or glowing primary buttons, a Manual / From-an-event switch.
