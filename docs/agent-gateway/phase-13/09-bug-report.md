# Phase 13 — 09 Bug report

## Discovered and fixed

| Id | Severity | Bug | Fix |
|---|---|---|---|
| P13-B1 | Medium (latent until the first keyed write) | Synchronous MCP calls had no way to carry an idempotency key, so a keyed capability such as `tickets.create` would be listed but could never run synchronously, and the refusal would happen in the resolver after the gate (an approval could be requested for a call that could not execute). | `params._meta` key (`mcp/request-meta.ts`), validated and checked before the gate. |
| P13-B2 | Low | The Phase 11 recovery executor uses idempotency keys `recovery.<ref>` under the original connection's scope, but agents could choose keys with that prefix on the task path (only `trigger.` was reserved). Exploiting it required guessing a 128-bit recovery reference. | `recovery.` reserved on the task and sync paths (`isReservedIdempotencyKey`). |

## Pre-existing, not fixed (human routes, outside the agent surface)

- PRE-13-1: `GET /api/tickets/[id]` returns internal staff notes (`TicketMessage.isInternal`) to the ticket's client, and it and `PATCH` check roles `ADMIN` / `STAFF`, which do not exist in the `Role` enum (`SUPER_ADMIN`, `SUB_ADMIN`, `VENDOR`, `CLIENT`, `GUEST`). Real admins therefore get 403 on other users' tickets, and an admin PATCH of their own ticket takes the client branch. `GET /api/tickets/[id]/messages` also returns internal notes. The agent adapters do not inherit any of this (`tickets.get` filters `isInternal: false`). Recommended fix for the support owner.
- PRE-13-2: `POST /api/tickets` accepts any `projectId` without checking the project belongs to the caller. Not reachable by agents (`tickets.create` has no `projectId`).
- PRE-13-3: `POST /api/tickets` and `PATCH /api/tickets/[id]` cast `priority` / `status` from the body without validation (a bad value becomes a 500). Agents use closed enums.
- Carried: PRE-12-1 (human product route serves any status), feedback-route TS error, ESLint baseline.
