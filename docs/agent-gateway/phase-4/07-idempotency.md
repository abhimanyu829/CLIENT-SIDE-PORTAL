# Phase 4 — Idempotency

## Design

Driven entirely by Phase 3's already-declared `idempotency` metadata on each `CapabilityDefinition` — no second, conflicting idempotency mechanism is introduced. `lib/agent-gateway/execution/idempotency/idempotency-guard.ts` reuses the EXISTING platform Redis client (`lib/redis.ts`, the same instance Phase 1's rate-limiter and Phase 2's connection-status cache already use) as a short-lived replay cache.

## Scope

`idempotencyScope` (from the capability definition) combined with the caller's `connectionId` — NEVER a client-supplied scope. The same idempotency key presented by two different connections is always treated as two unrelated requests (verified by test: "scope: same key from a DIFFERENT connection is treated as a new, unrelated key").

## Behavior

| Situation | Outcome |
|---|---|
| Capability doesn't require a key | `NOT_REQUIRED` — proceeds immediately |
| Capability requires a key, none supplied | `IDEMPOTENCY_KEY_REQUIRED` error — execution never proceeds |
| Capability requires a key, key supplied, never seen before | `NEW_KEY` — proceeds, result recorded after success |
| Capability requires a key, key supplied, already recorded | `REPLAY` — the ORIGINAL result is returned; the adapter is never invoked a second time |

## Fail-open, deliberately

Unlike Phase 1's rate-limiter and replay-protection (which fail CLOSED, since those are security controls), this cache fails OPEN when Redis is unavailable — treated as `NEW_KEY`/no-op, letting execution proceed. This mirrors Phase 2's connection-status-cache precedent exactly: it is a performance/convenience cache, not a security boundary. The REAL safety net for a non-idempotent mutation remains whatever DB-level uniqueness the underlying existing service already has (e.g. `Order.cartId`'s unique constraint, `Coupon.code`'s unique constraint) — this cache only protects against the AI-gateway-specific failure mode of a client retrying the exact same gateway request before the first attempt's result was ever returned to it.

## Current applicability

None of the 4 REGISTERED adapters (`products.list`, `products.get`, `subscriptions.get`, `tickets.list`) declare `requiresIdempotencyKey: true` — all four are pure reads, naturally idempotent, `retrySafe: true`. The idempotency guard is therefore exercised in this phase only by its own dedicated unit tests (`idempotency-guard.test.ts`, 7 tests) against synthetic capability definitions, and structurally proven safe for the two BLOCKED write capabilities (`products.createDraft`, `coupons.create`, both of which DO declare `requiresIdempotencyKey: true`) via the end-to-end test confirming they fail closed with `ADAPTER_NOT_FOUND` before the idempotency gate is ever reached — i.e., there is no path in this phase where a non-idempotent operation could be retried and duplicated, because no non-idempotent operation has an adapter yet.

## What happens when a future write-capability adapter IS added (forward-looking note, not implemented here)

The `AdapterResolver.execute()` flow already calls `checkIdempotency()` before `buildExecutionContext()`/`adapter.execute()` — a future adapter for `products.createDraft` (once a service-principal mechanism exists to unblock it) would automatically get idempotency enforcement for free, with zero changes to the resolver itself. This was a deliberate design choice: idempotency is a resolver-level concern, not something each adapter re-implements.
