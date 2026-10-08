# 08 — Test Report (Phase 1)

## Suites

| Suite | Command | Result |
|---|---|---|
| Phase-1 subscription suite (7 files) | `npm run test:subscriptions` | **95/95 PASS** |
| Existing agent-gateway suite | `npm run test` | 1462/1502 pass; **40 failures PRE-EXISTING** (proven — see below), 0 caused by Phase 1 |
| Typecheck | `npm run type-check` | Phase-1 errors: **0**; 3 pre-existing gateway errors (documented in 09) |
| Lint (all Phase-1 files) | `npx eslint <touched files>` | **clean** |
| Production build | `npm run build` | **PASS** (241 pages) |

## Phase-1 suite breakdown (95 tests)

| File | Tests | Covers |
|---|---|---|
| subscription-state-machine.test.ts | 16 | Full 5×5 transition matrix (legal + illegal + same-state), terminal protection, source validation, environment normalization, NODE_ENV mapping, initial-status validation |
| subscription-foundation.test.ts | 25 | Valid create (TRIALING/ACTIVE, periods, metadata externalReference), invalid owner/banned/unknown product/tier-mismatch/inactive tier, period order, strict schema (unknown keys, forged status/source/environment), owner-scoped read (match/cross-tenant/missing/forged ids), CAS transition (legal+audit, illegal pre-write refusal, idempotent, conflict, unknown id, garbage status) |
| subscription-domain-separation.test.ts | 12 | Schema-level: Order/OrderItem/Cart/CartItem have NO subscription refs; Payment.subscriptionId + CustomerEntitlement.subscriptionId OPTIONAL; Invoice keyed by paymentId; Product/Tier hold no subscription FK; migration additive-only (comment-stripped destructive-statement scan); code-level: foundation never touches order/payment/cart/invoice (fake-DB traps throw); subscription exists without Order |
| subscription-security.test.ts | 12 | Forged owner, cross-tenant read, forged team/org keys, forged status, forged provider refs, environment mismatch, insert-only create, denial-by-default reads |
| subscription-concurrency.test.ts | 5 | Parallel creates → 5 distinct records; racing conflicting transitions → exactly one wins, loser conflicts; racing identical transitions → deterministic + idempotent; stale-actor CAS failure; duplicate externalReference (metadata-only, no provider unique collision) |
| subscription-failure.test.ts | 11 | create failure → zero partial state; $transaction failure → status untouched + no audit; updateMany failure → status untouched; duplicate PK → constraint error, no overwrite; malformed input (6 shapes) rejected before any DB call; invariant sweep after mixed failures |
| subscription-service-guards.test.ts | 14 | Existing service + guards: cancel (legal + idempotent), pause (legal + CANCELLED refusal), reactivate, markSubscriptionPastDue (legal + **CANCELLED refusal = key hardening**), activate (TRIALING + CANCELLED-reactivation legal edge), changePlan (legal + CANCELLED-reactivation edge), startGracePeriod (legal + refusal), expireOverdueSubscriptions (filters correctly, cancelled untouched) |

## Pre-existing gateway failures (NOT Phase-1)

Full `npm run test`: 40 failures across p8/p12/p14/p15 suites. Root cause: commit
`125d2c5` ("Add product mutation capabilities") registered `products.createDraft/update/
archive` but did not refresh `manifest.lock.json` or the hard-coded tool lists in those
test suites; p15 also has env-dependent Host-header assertions.

**Proof:** Phase-1 changes were stashed (`git stash push`), the same failing tests were
re-run on clean HEAD — identical failures. Phase-1 diff touches ZERO files under
`lib/agent-gateway/` (`git diff --name-only HEAD` verified). Classified LEGACY /
pre-existing, documented, NOT fixed (outside Phase-1 scope per bug-fixing rules).

## Test infrastructure notes

- Separate vitest config: `vitest.subscriptions.config.ts` (does not disturb the
  gateway suite's setup file). Script: `npm run test:subscriptions`.
- In-memory Prisma fake: `lib/services/__tests__/helpers/fake-db.ts` (compare-and-set
  `updateMany`, `$transaction`, trap methods that throw if subscription domain ever
  touches Order/Payment). No network, no real DB.
