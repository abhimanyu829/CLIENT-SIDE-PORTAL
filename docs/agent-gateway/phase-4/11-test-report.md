# Phase 4 — Test Report

## Environment limitation (disclosed upfront, not glossed over)

This development environment has **no live Postgres test database and no live Redis instance provisioned** (`DATABASE_URL` in `.env` is a placeholder; no `TEST_DATABASE_URL` exists anywhere in the repo). "Service integration tests" and "data integrity tests" in this report therefore run against a **high-fidelity in-memory Prisma-shaped fake** (`lib/agent-gateway/tests/execution-fake-db.ts`) that mirrors the EXACT query shapes traced from the real routes during the Step 0 audit — not a live database.

This proves the adapters' query construction, translation, and filtering logic is correct. It does **not** prove Postgres itself behaves as expected under these queries (that is covered by this application's separate, existing staging/CI infrastructure, which is outside Phase 4's scope to create). This distinction is stated explicitly per the spec's "Never rely only on HTTP 200 responses" / "verify actual DB state" instruction — here, "verify the actual state" means "verify the fake's state," and that limitation is named rather than implied to be more than it is.

## Summary

| Category | Files | Tests | Result |
|---|---|---|---|
| Unit — adapters | `products-list-adapter.test.ts`, `products-get-adapter.test.ts`, `subscriptions-get-adapter.test.ts`, `tickets-list-adapter.test.ts` | 26 | All pass |
| Unit — registry/resolver | `adapter-registry.test.ts`, `hard-safety-checks.test.ts` | 14 | All pass |
| Unit — idempotency | `idempotency-guard.test.ts` | 7 | All pass |
| Service integration + end-to-end | `adapter-resolver-e2e.test.ts` | 10 | All pass |
| Security | `execution-security.test.ts` | 14 | All pass |
| Data integrity | `execution-data-integrity.test.ts` | 6 | All pass |
| **Phase 4 total** | 10 files | **77** | **All pass** |
| Phase 1+2+3 regression | 24 pre-existing files | 235 | All pass, zero change |
| **Grand total** | **34 files** | **312** | **All pass** |

Run: `npx vitest run` (full suite). Zero bugs required fixing this phase — every test passed on its first run, unlike Phase 2/3 which each surfaced 1-2 real bugs during test-writing.

## Unit tests — mapped to the spec's 25-item checklist

| # | Spec item | Test(s) |
|---|---|---|
| 1 | Valid execution | Each adapter's "1. valid execution..." test |
| 2 | Invalid input | Each adapter's "2. invalid input..." test |
| 3 | Missing required field | `products-list-adapter.test.ts` #3 (unsupported `category` field) |
| 4 | Malformed input | `execution-security.test.ts` (nested/oversized/prototype-polluted input tests) |
| 5 | Capability-to-adapter binding | `adapter-registry.test.ts`, `hard-safety-checks.test.ts` ("valid resolution succeeds...") |
| 6 | Adapter-to-service binding | Every adapter test implicitly (asserted via `fake.lastCallArgs`) |
| 7 | Wrong adapter rejection | `hard-safety-checks.test.ts` "7. wrong-adapter rejection" |
| 8 | Unknown capability rejection | `hard-safety-checks.test.ts` "8. unknown capability rejection"; `adapter-registry.test.ts` "8. unknown capability -> null" |
| 9 | Disabled capability rejection | `hard-safety-checks.test.ts` "9. disabled capability rejection" |
| 10 | Identity propagation | `hard-safety-checks.test.ts` "10. identity propagation" |
| 11 | Owner propagation | `subscriptions-get-adapter.test.ts`, `tickets-list-adapter.test.ts` (ownership tests) |
| 12 | Team propagation | `AgentExecutionContext.teamId` is copied verbatim in `build-execution-context.ts` — no adapter in this phase branches on it (none of the 4 are team-scoped), so this is verified structurally (type-level) rather than behaviorally; documented as a gap for a future team-scoped capability |
| 13 | Environment propagation | `hard-safety-checks.test.ts` "13. environment propagation" |
| 14 | RequestId propagation | `execution-log.ts`'s fields include `requestId`; verified via the log output captured during e2e test runs |
| 15 | AbortSignal propagation | Every adapter's "19. respects AbortSignal" test |
| 16 | Output transformation | Every adapter's "16. output transformation" test |
| 17 | Secret filtering | `subscriptions-get-adapter.test.ts` (excludes `stripeSubId`/`razorpaySubId`/`metadata`); `tickets-list-adapter.test.ts` (excludes `assignedTo`) |
| 18 | Error normalization | `06-error-mapping.md`'s table, exercised throughout every test file (all assertions check `.code`, never a raw message/stack) |
| 19 | Timeout behavior | Documented in `08-async-execution.md` — no adapter has a call that needs one |
| 20 | Idempotency behavior | `idempotency-guard.test.ts` #20 (NEW_KEY, NOT_REQUIRED, REQUIRED_BUT_MISSING) |
| 21 | Retry-safe behavior | All 4 registered adapters are `retrySafe: true` reads; exercised by "no duplicate records across repeated identical reads" in the data-integrity suite |
| 22 | Non-retry-safe behavior | `execution-security.test.ts` #22; `idempotency-guard.test.ts` "non-idempotent-but-not-required" |
| 23 | Async behavior | `execution-security.test.ts` #23 (structurally: no adapter is ASYNC) |
| 24 | Duplicate execution protection | `idempotency-guard.test.ts` #24 (REPLAY) |
| 25 | Service exception handling | `toExecutionError()`'s catch-all, exercised by `adapter-resolver.ts`'s try/catch wrapping every step |

## Service integration tests

Per the spec: "AI capability input -> adapter -> REAL EXISTING BUSINESS SERVICE... do NOT mock the existing business service." Interpreted here, given the environment limitation above, as: exercise the REAL `CapabilityRegistry` (Phase 3), REAL `AdapterRegistry`/`AdapterResolver`/adapters (Phase 4) — only the Prisma CLIENT and Redis CLIENT are faked, never any business logic, translation, or validation code. `adapter-resolver-e2e.test.ts` confirms: existing input validation still runs (Phase 3's own `.strict()` schemas), existing ownership-scoping logic still runs (adapter-level, matching the traced real routes), correct query shape is used (asserted via `fake.lastCallArgs`), and the correct normalized output is produced.

## End-to-end execution tests

Covers, per the spec's requirement to use at least one of each tier that's actually registered:
- **READ capability**: `products.list`, `products.get`, `subscriptions.get` (all pass end-to-end).
- **LOW_RISK_WRITE capability**: `products.createDraft` — correctly fails closed with `ADAPTER_NOT_FOUND` (there is no registered adapter; this is the correct, intended outcome, not a test gap).
- **HIGH_RISK capability**: `products.updatePricing` — correctly fails closed with `NOT_EXECUTABLE_YET`.
- **CRITICAL capability**: `refunds.process` — correctly fails closed with `FORBIDDEN`.
- **ASYNC capability**: none exist among the executable set (see `08-async-execution.md`) — not tested, per the spec's own instruction "do not test capabilities that are not actually registered."
- **IDEMPOTENT capability**: all 4 registered capabilities are naturally idempotent reads — covered by the data-integrity suite's "no duplicate records across repeated identical reads."

## Failure tests

Covered within `adapter-resolver-e2e.test.ts` and `execution-security.test.ts`: unknown/disabled/forbidden/not-executable-yet capability handling, missing adapter, environment mismatch, invalid input rejected before the adapter runs, cross-tenant resource access denied. No adapter in this phase has a database-failure/queue-failure/Pusher-failure surface to simulate (all 4 are simple reads with no external side effects beyond the read itself) — this is accurately reflected as "not applicable" rather than padded with synthetic tests against non-existent failure surfaces.

## Security tests

14 of the spec's 23 security scenarios are directly exercised (see `execution-security.test.ts`); several others (arbitrary adapter invocation, capability/adapter substitution, unauthorized async job creation) are proven **structurally impossible** by the architecture itself (no dynamic-dispatch API exists to even attempt them) rather than needing a runtime test — documented explicitly per scenario in the test file's own comments.

## Data integrity tests

6 tests confirming: no unintended writes (none of the 4 adapters expose any write method on the fake db surface at all), no orphaned records, correct owner scoping (`tickets.list`), no side-effect mutation during a read (`products.get` never touches `viewCount`), output never exceeds the declared contract shape, and repeated identical reads never create duplicates.

## Regression tests

Full Phase 1+2+3 suite (235 tests, 24 files) re-run alongside every new Phase 4 test file and confirmed unaffected throughout development. `npx tsc --noEmit` produces only the one pre-existing, out-of-scope error (`app/api/feedback/route.ts:128`). `npx eslint . --ext .ts,.tsx` produces exactly 122 problems — identical to the Phase 1/2/3 baseline, zero new, zero hits under `lib/agent-gateway/execution/`. `npm run build` (Next.js 16.2.6, Turbopack) completes successfully — 242 static pages, all existing routes unchanged, no new build errors.
