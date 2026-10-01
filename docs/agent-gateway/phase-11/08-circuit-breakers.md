# Phase 11 — 08 Circuit breakers

`resilience/circuit-breaker.ts`, enforced in `AdapterResolver` around the adapter call (the single execution chokepoint).

## Scopes and thresholds

| Scope | Key | Opens after | Why |
|---|---|---|---|
| CAPABILITY | capability id | 5 failures / 60 s | a broken capability stops receiving agent traffic |
| ADAPTER | adapter key | 5 failures / 60 s | a broken adapter shared by versions |
| CONNECTION | connection id | 20 failures / 60 s | one agent failing across capabilities |

`CLOSED → OPEN` at the threshold; `OPEN` refuses for 30 s (cooldown); then `HALF_OPEN` admits one probe; success → `CLOSED`, failure → `OPEN`.

There is no global breaker: one failing capability never disables the platform. The connection threshold is deliberately four times the capability threshold, and calls refused by an already-open breaker never dispatch and never count, so one broken capability (which opens its own breaker after 5) cannot lock an agent out of its other capabilities (tested).

## What counts

Only infrastructure failures of a **dispatched** call: `EXECUTION_UNAVAILABLE`, `INTERNAL_ERROR`, `TIMEOUT`. Caller errors (`INVALID_INPUT`, `RESOURCE_NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, idempotency errors) and denials never count — the dependency answered, so it is healthy (tested: 15 caller errors leave every breaker closed). A call refused before dispatch releases any half-open probe slot without a verdict.

## Behaviour when open

The resolver throws `EXECUTION_UNAVAILABLE` ("temporarily unavailable after repeated failures; retry later") **before** the adapter runs, marked `details.dispatched = false`, so the Phase 8 worker retries a queued non-idempotent write instead of failing it. Only the resolver can set that marker; an adapter-supplied `dispatched` claim is stripped (tested). Transitions are ledger events (`failure.circuit_opened` / `half_open` / `closed`; rejections throttled per scope key) and `agent_circuit_transition_total{scope, state}`.

## State

Process-local, like the metrics: each web / worker process protects itself; nothing is shared through Redis or Postgres, so the breaker itself cannot become a cross-instance outage. Rejected alternatives: a DB-backed breaker (adds a write to every failure and a new dependency on the hot path) and a global breaker (one bad capability would stop everything). Durable, cross-instance safety decisions (pausing a rollout) are Phase 15 health gates over Postgres, which breaker events feed through the ledger.

`/admin/agent-governance/runtime` shows the breakers that are not closed in the process that rendered the page.
