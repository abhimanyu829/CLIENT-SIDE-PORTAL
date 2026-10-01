# Phase 10 — Security Model

## Who

| Surface | Check (existing code) | Sub-admin | Agent credential |
|---|---|---|---|
| Governance pages + layout | `requireSuperAdmin()` (DB re-read of role and ban) on every page | redirected, whatever permissions it holds | n/a (no session) |
| Governance mutations | `requireHumanApprover()` = SUPER_ADMIN + live Clerk session + no `Bearer agw_` / signed-request headers | redirected | `401 HUMAN_APPROVAL_INVALID`, even with an admin session |
| Admin layout | `requireAdmin()`: governance paths are deliberately absent from the sub-admin policy tables, so sub-admins are denied there too | redirected | — |

No new permission, role or sub-admin resource was added (`lib/subadmin-permission-policy.ts` unchanged, asserted by test).

## Request hardening

- JSON only (`415` otherwise): a cross-site form post cannot reach a mutation, and cross-origin JSON requires a CORS preflight these routes never grant.
- Bodies ≤ 32 KB, strict zod schemas (unknown keys → 400), actor ids only from the session, refs validated by pattern before any lookup.
- Responses `Cache-Control: no-store`; errors are `{ success:false, code, error }` with generic messages; Next.js redirects are re-thrown, never swallowed.

## What is never shown

Credential hashes, signing-secret and webhook-secret ciphertexts, webhook secrets after creation/rotation, step-up material, binding digests and display summaries outside the decision page, task inputs and results, idempotency scopes. Views are explicit allowlists (`views.ts`), and the UI suite scans every governance page for the planted secrets.

## Integrity

- Optimistic concurrency on triggers, policies and autonomy; status preconditions on task cancellation; idempotent state machines for connections.
- Every mutation re-validated by the owning service (Phase 2/6/7/8/9); the UI is never trusted.
- Every mutation audited to the existing `AuditLog` (`lib/audit.ts`), secrets excluded.

## Shared invariants (Phases 1–10)

| # | Invariant | Proven by |
|---|---|---|
| 1 | No agent action without an authenticated, ACTIVE connection identity | Phase 2 suites; master E2E 2 & 18 |
| 2 | No policy → deny | master E2E 3; Phase 6 suites |
| 3 | Explicit DENY wins over ALLOW | Phase 6 precedence suite |
| 4 | Autonomy only narrows; mandatory approvals cannot be removed | Phase 7 suites; Scenario 9; capability page |
| 5 | Approvals are single use and bound to one operation | Scenario 2; master E2E 15 |
| 6 | A policy / autonomy change invalidates pending approvals | Scenario 7 |
| 7 | Every async execution is re-authorized at execution time | Scenarios 6, 8, 9 |
| 8 | One task per idempotency key per connection; duplicates execute once | Scenario 11; Phase 8 suites |
| 9 | Retries only as capability metadata allows | Phase 8 worker suite |
| 10 | Task results are visible only to the owning connection and owner, and never in governance | Scenario 12; views G |
| 11 | A revoked connection executes nothing and keeps no live trigger | Scenario 8; master E2E 18 |
| 12 | A trigger grants nothing; every firing is authorized | Scenarios 9–10; Phase 9 runtime F |
| 13 | One run per delivery, one task per run | Phase 9 suites; Scenario 11 |
| 14 | Webhook signatures bind every part; nonces are single use; Redis outage fails closed | Phase 9 webhook suite; master security |
| 15 | Schedules never replay a backlog | Phase 9 schedule tests |
| 16 | Concurrency limits are decided by the database | Phase 9 runtime E |
| 17 | Postgres is the single source of truth; Redis holds references only | Phase 8/9 architecture; Phase 9 integration |
| 18 | Secrets are shown once, encrypted or hashed at rest, never rendered, logged or audited | routes B/H; UI; master E2E 19 |
| 19 | Governance is SUPER_ADMIN only; sub-admins are refused with any permissions | access suite; Scenario 12; master security |
| 20 | Agent credentials can never perform governance or approvals | access suite; master security |
| 21 | Stale configuration edits are conflicts, never silent overwrites | routes D/E/H; master E2E 16 |
| 22 | Dangerous operations are confirmed and audited | UI suite; routes audit assertions |
| 23 | No generic execution or governance endpoint | route inventory test |
| 24 | Errors are stable codes without internals | every suite; UI "unavailable" test |
| 25 | Every new surface is off or inert by default; disabled = previous behaviour | config tests (Phases 8–9); optional-field back-compat tests (Phase 10) |
