# Phase 13 — 05 Support

| Operation | Readiness | Capability |
|---|---|---|
| list my tickets | READY (Phase 4) | `tickets.list` |
| read one of my tickets | READY | `tickets.get` |
| open a ticket | READY (first executable agent write) | `tickets.create` |
| close my ticket | READY | `tickets.close` |
| reply to a ticket | NOT_READY | — |
| assign / prioritise / resolve | NOT_READY (staff only) | — |

## tickets.get (READ)

Owner check as the client branch of `GET /api/tickets/[id]`, but: internal staff notes (`isInternal`) are never returned; no staff identity (`assignedTo`, assignee / client e-mail, sender ids) — a message only carries `fromCustomer`; the latest 50 messages, oldest first, with `messagesTruncated`; attachments omitted. Trust `THIRD_PARTY_CONTENT`.

## tickets.create (LOW_RISK_WRITE)

- Input: `{ subject: 3..200, description: 10..5000, priority?: LOW|MEDIUM|HIGH, category?: GENERAL|BILLING|TECHNICAL|ACCOUNT|PRODUCT|OTHER }` (strict). `CRITICAL` is a staff triage decision; no `projectId` (the human route does not check project ownership); `clientId` is always the owner.
- Same write and defaults as `POST /api/tickets` (trimmed text, MEDIUM, GENERAL).
- Requires an idempotency key (`01-domain-expansion`). Permission `write:tickets`. Not approval-mandatory (not financial, reversible): autonomous at `LIMITED_AUTONOMY`, approval at `ASSISTED` / `APPROVAL_REQUIRED`, denied below.
- Phase 11 strict intent: `execution.started` is recorded before the write; a ledger outage refuses the write.
- Recovery: `COMPENSATABLE` via `tickets.close` with `{ ticketId: "output.id" }`, captured at execution time (`recoveryInput`). Residual effect: the ticket stays on record as CLOSED.

## tickets.close (LOW_RISK_WRITE)

- Input: `{ ticketId }`. Owner check, then a conditional `updateMany` on `{ id, clientId: owner }` to CLOSED (a ticket that changed hands in between is not touched; `CONFLICT`).
- End-state idempotent: closing a CLOSED ticket returns `changed: false`, so it needs no key and is safe as a recovery step.
- Reversibility `REVERSIBLE` (staff can reopen); its own recovery is manual (no agent reopen capability).

## Why replies stay NOT_READY

A reply cannot be retracted (no delete path), so it would be IRREVERSIBLE (approval-mandatory), and the existing messages route also calls an external real-time service (Pusher) from the request; that outbound path would need the Phase 12 outbound guard first.

## Proof

`p13-domains` E (tickets.get) and `p13-support-writes` (13): owner-only create with route defaults and ordered audit intent; no key → nothing runs; malformed / reserved keys; no owner / project / staff priority / unknown category; hidden characters refused, instruction-like text stored as data and flagged; ASSISTED → approval → exactly one execution, single-use approval; denied without policy or with READ-only autonomy; ledger outage refuses; task path dedupes durably; close is owner-only and idempotent; no staff transitions; recovery closes the ticket exactly once as the original connection; recovery refused when the connection lost write autonomy.
