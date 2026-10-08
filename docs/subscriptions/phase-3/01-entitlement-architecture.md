# 01 — Entitlement Architecture (Phase 3)

## Role in the platform

The entitlement engine is a RESOLUTION LAYER between commercial definitions and
customer access. It answers "what does this customer have / may use / how much /
until when / from which source" — deterministically and server-side. It is NOT a
billing system, NOT authorization, and NOT a second commerce database.

```
PLAN CATALOG (Phase 2): PlanVersion -> PlanItems
        |
        v
ENTITLEMENT ENGINE (Phase 3)
  definitions . grants . resolver
        |
   +----+----+----+----+
   |    |    |    |    |
 PRODUCT SERVICE FEATURE AI LIMITS
```

## Sources (both read, never written by this phase)

1. `EntitlementGrant` rows (new; created ONLY by the trusted backend service).
2. Existing `CustomerEntitlement` rows (standalone purchases + the pre-existing
   subscription sync) — adapted READ-ONLY into effective entitlements, with the
   purchase/subscription domain untouched.

## Key separation

- Entitlement: "customer HAS product X".
- Authorization: "may this actor touch X in this request" (owned by existing
  RBAC / agent-gateway authorization — untouched).
- Product availability: Product status lives in the Product system; a grant does
  not publish or modify products.

## Phase boundaries respected

In: domain, grants, scopes, limits, lifecycle, effective-access resolution,
precedence, expiration, revocation, source tracking, access checks, standalone
adapter, cache + invalidation, tests.
Out (later phases): Razorpay/recurring, checkout, subscription provisioning,
free/trial engines, customer/admin UI, AI governance, reconciliation.

## Files

- `lib/services/entitlement-lifecycle.ts` — pure rules (status machine, time,
  keys, dedupe, limit rule, plan-item contract)
- `lib/services/entitlement-service.ts` — definitions + grants (only mutation path)
- `lib/services/entitlement-resolver.ts` — effective access, cache, standalone adapter