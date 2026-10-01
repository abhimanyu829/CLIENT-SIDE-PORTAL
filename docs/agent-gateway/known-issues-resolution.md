# Known issues after Phase 15 — resolution

Every item left open in the Phase 15 report, plus the defects found while fixing them. Deployment steps are in `deployment-runbook.md`.

## Agent gateway

| Id | Issue | Resolution | Tests |
|---|---|---|---|
| P14-F2 (Low) | Under approval-gated autonomy an agent could raise an approval request for a resource its owner does not own. | Adapters of owner-scoped capabilities (`tickets.close`, `tickets.get`, `subscriptions.get`, `analytics.productPerformance`) gained a read-only `checkResource` (`execution/contracts/adapter.ts`). The gate runs it before an approval is requested **or consumed** (`execution-gate/gate.ts`, step 4a) and refuses with gate code `RESOURCE_NOT_FOUND` and the adapter's own message, so the answer is byte-identical to an autonomous call's (no existence oracle). A store failure is `POLICY_UNAVAILABLE`. Autonomous calls and the worker's re-check are unchanged (the adapter checks ownership itself). | `hardening-approval-gate.test.ts` (7), ADV-3 updated, corpus `REG-P14-F2` |
| P14-F3 (Info) | A changed input under an existing approval is refused and also leaves a new pending approval. | Re-checked: the refusal already names the new request (`New approval reference: apr_…`), and the new request is legitimate (the changed input is a different operation that may be approved). The real exposure was unbounded approval spam by varying the input, so live pending requests per connection are capped at 20 (`approvals/constants.ts`): a call that would create the 21st is refused with `APPROVAL_LIMIT_REACHED` and creates nothing; repeating an already pending operation still answers with its reference. Soft limit (concurrent calls at the boundary may exceed it by a few). | `hardening-approval-gate.test.ts` (3) |
| Sync idempotency | If Redis was down, synchronous keyed writes had no duplicate protection; two concurrent identical calls could both run even with Redis up. | `execution/idempotency/idempotency-guard.ts` has two modes. STRICT (synchronous MCP calls, the default): a Redis error, or no Redis in production, refuses the write before anything runs (`EXECUTION_UNAVAILABLE`, not dispatched); the key is reserved atomically (`SET NX`, 10 minutes) so a concurrent duplicate gets `IDEMPOTENCY_CONFLICT`; the reservation is released only when the write provably had no effect (refused before dispatch, or `INVALID_INPUT` / `RESOURCE_NOT_FOUND` / `FORBIDDEN` / `CONFLICT`), and kept after an ambiguous failure so a blind retry cannot run it twice. BEST_EFFORT (task worker, recovery): unchanged, because those paths have durable dedupe (`AgentTask.idempotencyScope`, one `AgentRecovery` per event) and must keep working through a Redis outage. | `hardening-idempotency.test.ts` (14), `idempotency-guard.test.ts` updated |

Agent-facing codes added: `RESOURCE_NOT_FOUND` and `APPROVAL_LIMIT_REACHED` (gate), `IDEMPOTENCY_CONFLICT` with a new meaning on the sync path. Trigger runs refused by either gate code are recorded as `DENIED`; the ledger keeps the precise reason.

## Human routes (outside the agent surface)

| Id | Issue | Resolution |
|---|---|---|
| PRE-12-1 | `GET /api/products/[slug]` served products of any status, unmoderated reviews, and every column. | Same rule as the storefront page: AVAILABLE only (otherwise the same 404 as a missing slug), APPROVED reviews only, and non-public fields stripped (`deliveryConfig`, owner-only access URLs and notes, reservation holder, editor bookkeeping) via `lib/sanitize-product.ts`. The public list `GET /api/products` returned the same fields and is sanitised too. `PATCH` (it checked a non-existent role, so it was always 403) is now an explicit 403 without the unvalidated update path. No page in the app calls either API. |
| PRE-13-1 | Ticket routes showed staff-internal notes to customers and checked roles (`ADMIN`, `STAFF`) that do not exist. | `lib/support-tickets.ts`: staff = SUPER_ADMIN, or SUB_ADMIN with an active admin credential session and the workforce **Support** permission (VIEW to read, EDIT to manage), the same rules as the admin panel. Internal notes are filtered in the query for everyone else (`GET /api/tickets/[id]`, `GET /api/tickets/[id]/messages`). Someone else's ticket is a 404, like a missing one. The list route uses the same staff rule (a SUB_ADMIN without Support now sees only their own tickets). |
| PRE-13-2 | `POST /api/tickets` accepted any `projectId`. | The project must belong to the caller; otherwise 404 and nothing is created. |
| PRE-13-3 | Ticket fields were cast without validation (bad values became 500s). | zod validation on create, staff update and messages; bounded lengths; status / priority filters validated; an assignee must be an active staff account; a missing ticket is a 404 instead of a database error. |

Found and fixed while in there:

- The live dashboard form (`components/dashboard/TicketsClient.tsx` → `POST /api/dashboard/tickets`) offered priority **Urgent**, which is not a `TicketPriority`, so every urgent ticket failed. The form now sends `CRITICAL` (label unchanged) and the API also accepts `URGENT` for cached old pages.
- `POST /api/ai/chat` (public) created an escalation ticket owned by whatever id the request body named. It now does so only for a signed-in caller naming their own account (the site's chat widget sends a random guest id, which never created a ticket, so its behaviour is unchanged).
- `POST /api/feedback` created its shared guest author with role `USER`, which does not exist, so the first guest feedback failed; it is `GUEST` now (this was also the project's only TypeScript error). `GET /api/feedback` (public) no longer returns reviewers' e-mail addresses (the page never displays them).

Tests: `hardening-human-routes.test.ts` (23).

## Database

- `20260916090000_catalog_intelligence` could never run (it created an index before its table), which blocked every later migration in `prisma migrate deploy`. It is now idempotent: `CREATE … IF NOT EXISTS` and foreign keys added only when missing. It never applied anywhere, so changing it is safe. Verified on a throwaway PostgreSQL loaded with the production schema (`deployment-runbook.md`).
- `scripts/agent-gateway-readiness.cjs`: read-only pre-flight (migrations, Redis, encryption key, SMS configuration, approvers with a verified phone, credential store, flags).

## Not done here (needs a person)

Applying the migrations to the real database, a live SMS approval drill, and an authenticated browser check of the admin pages. Steps for each are in `deployment-runbook.md`.

## Not changed (noted for the owners)

- `POST /api/products` lets any SUB_ADMIN create a draft product without the workforce Products permission.
- `GET /api/tickets/[id]` still shows the assigned staff member's e-mail to the customer.
- Each product accepts one review per user, so the shared guest author can leave only one guest review per product.
