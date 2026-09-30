# Phase 4 — Async Execution, Timeout, and Cancellation

## Async execution

All 4 registered adapters declare (and their capability's Phase 3 metadata confirms) `executionMode: "SYNC"` — none of them touch BullMQ or any queue. `ExecutionResult.taskReference` and `.executionMode: "ASYNC"` exist in the type model (per the spec's requirement that the contract SUPPORT async execution reusing an EXISTING queue entry point) but are unused in this phase, since none of the 4 executable, safely-adaptable capabilities are long-running. No new queue implementation, no new task-state model, no Phase 8 task engine was built — verified structurally by a security test asserting every registered capability's `async.executionMode` is `"SYNC"`.

## Timeout

No adapter in this phase makes a call that could plausibly hang — all 4 are single, indexed Prisma reads. No arbitrary global timeout was introduced (the spec explicitly warns against one breaking legitimate long-running deployment operations, which don't exist as adapters in this phase anyway). If a future async capability's adapter is added, it must reuse the EXISTING BullMQ job/worker's own timeout semantics, never invent a new one — this is documented here as the forward-looking rule, not implemented.

## Cancellation

Every adapter checks `context.signal.aborted` and throws `ExecutionError("CANCELLED", ...)` BEFORE invoking its bound existing service, if the signal was already aborted by the time `execute()` runs. `context.signal` is propagated unchanged from the Phase 1 gateway request's own `AbortSignal` (`AgentGatewayRequestContext.signal`) — Phase 4 does not create a second, competing abort mechanism.

Verified by test for all 4 adapters (`products-list-adapter.test.ts`, `products-get-adapter.test.ts`, `subscriptions-get-adapter.test.ts`, `tickets-list-adapter.test.ts`, each with a "19. respects AbortSignal" test): when the signal is pre-aborted, the adapter's underlying `db.*` call is never made at all (asserted via `fake.lastCallArgs(...)` being `undefined` after the cancelled attempt).

## What is NOT implemented, and why

Mid-flight cancellation (aborting a Prisma query that is already in progress) is not implemented — Prisma's query functions don't accept an `AbortSignal` parameter in this codebase's Prisma version/usage pattern, and all 4 real queries are fast, indexed, single-row/small-result lookups where mid-flight cancellation would provide negligible benefit relative to the complexity of adding it. This is a known, low-risk limitation, documented rather than worked around with a synthetic timeout wrapper that could mask real latency issues.
