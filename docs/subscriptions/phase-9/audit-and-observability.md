# Audit & Observability — Phase 9

## Ledger

Every capability invocation (authorized or denied, read or mutation) is
recorded by the existing Agent Gateway audit ledger (chain of hashed entries)
with capability id/version, risk tier, resource type/ref, environment,
connection/owner context and result — no new audit store.

## Decision vs outcome

- Denied invocations are distinguishable from attempted/completed business
  operations via the ledger's decision/result fields.
- Mutation outcomes are additionally recorded by the backing services'
  existing audit paths (Phase-6 enrollments, Phase-4 cancellation audit).
- Correlation follows the gateway's request/execution reference conventions.

## Privacy

- No tokens, provider secrets, webhook signatures or unredacted payloads are
  logged; outputs pass the gateway's output-safety/redaction pipeline.
- Structured, sanitized metadata only; existing retention/access rules apply.

## Failure behavior

- Ledger-down mutation write is refused before dispatch (existing Phase 11
  fail-closed test proves it) — a mutation cannot be reported as audited when
  the ledger failed.