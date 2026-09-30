# Phase 8 — Retry Policy

The retry class is derived from each capability's own Phase 3/4 metadata when the task is created (`retry-policy.ts`). There is no universal policy.

| Class | Rule | Max attempts | Retries on |
|---|---|---|---|
| SAFE_RETRY | `idempotency.class = IDEMPOTENT` and `retrySafe` | 3 | any transient failure |
| CONDITIONAL_RETRY | non-idempotent, not declared unsafe | 3 | transient failures **before** the adapter was dispatched only |
| NO_RETRY | irreversible, FORBIDDEN, CRITICAL, financial (Phase 7's financial rule), `retrySafe = false` without a key, or missing metadata | 1 | never |

Current manifest: the four READ capabilities are SAFE_RETRY; `products.createDraft`, `coupons.create`, `products.updatePricing` are CONDITIONAL_RETRY; `refunds.process` is NO_RETRY. Only the READ capabilities are async-capable in Phase 8; the other classes are proven with fixtures.

## Transient vs definitive

Transient: Phase 4 `EXECUTION_UNAVAILABLE`, `INTERNAL_ERROR`, `TIMEOUT`, and pre-dispatch infrastructure failures (policy/approval/connection store unavailable). Everything else (`INVALID_INPUT`, `RESOURCE_NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, ...) is a definitive answer: `FAILED EXECUTION_FAILED`, no retry.

The resolver reports an adapter output that violates its contract as `INTERNAL_ERROR`; a SAFE_RETRY read retries it (harmless, nothing stored), a CONDITIONAL write does not.

## Outcome

- retryable and attempts < max: `FAILED(retryScheduled) -> RETRY_QUEUED` and one delayed job for attempt n+1;
- retryable but attempts = max: `FAILED RETRY_EXHAUSTED`;
- not retryable: `FAILED EXECUTION_FAILED` (the Phase 4 code is kept as `errorDetailCode`).

Backoff before attempt n+1: `1000 × 2^(n−1)` ms (1 s, 2 s). Verified with real delayed BullMQ jobs.

## Why CONDITIONAL retries only pre-dispatch

After a non-idempotent adapter was invoked, the engine cannot know whether the mutation happened. Retrying could duplicate it, so it does not.

A task in CANCELLING is never retried.
