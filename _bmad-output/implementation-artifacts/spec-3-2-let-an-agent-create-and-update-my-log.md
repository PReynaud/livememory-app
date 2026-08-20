---
title: 'Let an agent create and update my log'
type: 'feature'
created: '2026-08-20'
status: 'in-review'
baseline_commit: '21a2c9bf1cbf13c9fdc727788b8d0f3b322d4894'
story: '3-2-let-an-agent-create-and-update-my-log'
---

# Story 3.2: Let an agent create and update my log

## Intent

After Story 3.1's personal key and JWT mint, bind MCP so an agent can list, read, create, update, move, and delete Events and Concerts (including Attendance) with the same validation as the UI. Agent-created rows are the same table rows the form writes. Screenshot interpretation and OAuth stay out of v1. Joiner-agent and unauthenticated-write cases as a dedicated story wait for 3.3; domain already refuses joiner Bill writes.

## SDK / transport

- Package: `@modelcontextprotocol/sdk` v1 (Streamable HTTP).
- Host: Nitro `POST /api/mcp` so Vercel can serve it. Stateless (`sessionIdGenerator: undefined`) with `enableJsonResponse: true` (JSON, not SSE) so serverless instances do not need in-memory sessions.
- Auth: personal key on each request as `Authorization: Bearer <key>` or `x-livememory-key`. Nitro calls `exchangePersonalKey` (3.1), then `createClient` with the minted user JWT + anon key. That client is passed into `shared/domain`. `service_role` is never used for Event/Concert/Attendance queries.
- Cursor/Claude config points at `/api/mcp` plus the personal key. `/api/mcp/exchange` remains for mint-only.

## Acceptance Criteria

**Given** a valid personal key
**When** the agent creates a Concert or Event
**Then** the row is indistinguishable in the UI from one created in the form (same fields, same rules) (FR-17, UX-DR24)

**Given** Concert identity cases
**When** the agent creates
**Then** outcomes are `attached`, `impossible_place`, `needs_choice`, or `created` — the same attach-or-create choice as the UI, not warn-then-save-anyway (FR-13, FR-17, AD-10)

**Given** Event delete, move, and date rules
**When** the agent mutates
**Then** FR-11, FR-12, and FR-6 apply unchanged (FR-17)

**Given** MCP tools
**When** they persist
**Then** they call `shared/domain` after Nitro mints the user-scoped client; they do not invent SQL (AD-1)
**And** this story ships after UI CRUD (Epic 1); it is not a substitute for the first UI path (addendum, FR-17)

## Code Map

- `server/api/mcp/index.ts` — Streamable HTTP POST; CORS; personal-key auth; mint; user-scoped client
- `server/api/mcp/exchange.post.ts` — unchanged contract; env read shared via `readMcpSupabaseEnv`
- `server/utils/mcp-auth.ts` — Bearer / `x-livememory-key`
- `server/utils/mcp-runtime.ts` — Supabase URL, anon, service role (mint/lookup only)
- `server/utils/mcp-user-client.ts` — supabase-js with user JWT + anon key
- `server/utils/mcp-log-tools.ts` — `invokeLogTool` → domain (`createConcert` confirm attach|create, list via `listOwnedEvents` / `listOwnedConcerts` / `listMyAttendance` on `attendance_effective`, delete/move confirm wrapping `eventHasJoiners` / `concertMoveWouldLoseJoiners`)
- `server/utils/mcp-server.ts` — `McpServer` tool registration
- `tests/unit/mcp-log.spec.ts` — tools call domain not SQL; identity outcomes; confirm gates
- `tests/e2e/mcp-log.spec.ts` — key → create Concert visible on Concerts; `needs_choice` then attach
- `tests/e2e/helpers/mcp-client.ts` — official SDK Streamable HTTP client

Join/leave MCP tools are deferred to 3.3. List/read uses existing owned+joined SELECT (RLS) through `listOwnedEvents` / `listOwnedConcerts`; no second list query.
