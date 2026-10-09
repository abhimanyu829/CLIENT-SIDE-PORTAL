# 12 — Phase 5 Exit Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Subscription resolves to correct immutable PlanVersion | ✅ bound `planVersionId`; DRAFT rejected; superseded accepted |
| 2 | All plan items validated before provisioning | ✅ resolve-plan loop + definition checks precede any grant |
| 3 | Supported items map deterministically | ✅ `describePlanItemEntitlement` (Group A) |
| 4 | Unsupported items fail visibly and safely | ✅ FAILED_PERMANENT, zero grants, error recorded |
| 5 | Activation provisioning works | ✅ verified ACTIVE + period only (Group B) |
| 6 | Renewal extends correct periods | ✅ strictly-later extension, no duplicates (Group C) |
| 7 | Repeated events cannot duplicate grants | ✅ dedupeKey + findUnique + replay test |
| 8 | Paid-through periods respected | ✅ grantWindow from subscription timestamps; halt never extends |
| 9 | Cancellation behavior correct | ✅ period-end preserves; immediate revokes source only (Group E) |
| 10 | Expiration correct | ✅ boundary + guard vs renewed period (Group D) |
| 11 | Pause/halt follows explicit rules | ✅ suspend on pause; no-extension on halt |
| 12 | Standalone grants preserved | ✅ mandatory overlap tests (Group F) |
| 13 | Overlapping grants handled correctly | ✅ A-vs-B, sub-vs-standalone, sub-vs-admin |
| 14 | Phase-3 resolver remains authority | ✅ engine writes only through Phase-3 services |
| 15 | Database state correct | ✅ migration applied; uniqueness/indexes verified |
| 16 | Cache invalidation correct | ✅ post-commit invalidation tests (Group I) |
| 17 | Retries safe | ✅ identity reuse; retryable/permanent classification |
| 18 | Concurrency deterministic | ✅ activation/renewal/expiration/cancel races (Group K) |
| 19 | Security tests pass | ✅ Group J (13 tests) |
| 20 | Failure tests pass | ✅ Group L (no unsafe grants) |
| 21 | Standalone regression passes | ✅ 95/84/88/87 prior suites green; zero commerce file changes |
| 22 | Typecheck | ✅ Phase-5 errors 0 (3 pre-existing only) |
| 23 | Lint | ✅ clean |
| 24 | Production build | ✅ PASS (242 pages) |
| 25 | Database verification | ✅ applied + structure verified |
| 26 | Git diff scoped | ✅ below |
| 27 | Documentation complete | ✅ 01–12 |

## Git diff scope

New: `lib/services/subscription-provisioning.ts`, migration
`20261008040000_subscription_provisioning`, `vitest.provisioning.config.ts`,
7 test files + `fake-provisioning-db.ts`, docs 01–12.
Modified (additive only): `prisma/schema.prisma` (+1 model, 2 enums,
UserSubscription back-relation), `entitlement-service.ts`
(+`expireEntitlementGrant`, `extendEntitlementGrant`),
`razorpay-subscription-webhook.ts` (+provisioning hook),
`queue.ts` (+job name), `workers.ts` (+job branch), `event-bus.ts` (+5 keys),
`package.json` (+script). No commerce/checkout/payment/product/admin/provider
code changed; no Razorpay logic added.

## Protected systems

Standalone commerce, cart, checkout, one-time Razorpay, PhonePe, Paytm, orders,
invoices, products, marketplace, auth, RBAC, workers — unchanged. Phase 1
foundation, Phase 2 catalog, Phase 3 entitlement engine, Phase 4 billing —
reused/preserved (suites + structure tests).

## Final Phase-5 status

**COMPLETE** — all 27 exit criteria ran and passed. Phase 6–10 not started.