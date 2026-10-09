# Architecture — Phase 7

## Dependency map (verified)

```
Customer UI (dashboard/subscription/*)
  ↓ fetch (authenticated, session-scoped)
Customer API (/api/customer/subscriptions/*)
  ↓ ownership + published-plan + eligibility checks
Phases 1–6 domain services
  (razorpay-billing, free-trial-service, customer-subscription-view,
   entitlement-resolver, plan-catalog-service)
  ↓
Trusted DB state + Phase-3 resolver (authoritative access)
```

## Routes

| Route | Purpose | Backing service |
|---|---|---|
| GET /api/customer/subscriptions/overview | composed customer state | `customer-subscription-view.getCustomerSubscriptionOverview` |
| GET /api/customer/subscriptions/plans | published plans + items | `customer-subscription-view.listCustomerPlans` |
| POST /api/customer/subscriptions/enroll-free | Free Forever | `enrollFreePlan` (Phase 6) |
| GET /api/customer/subscriptions/trial?planId= | eligibility (read-only) | `getTrialEligibility` (Phase 6, new) |
| POST /api/customer/subscriptions/trial | start trial | `startTrial` (Phase 6) |
| POST /api/customer/subscriptions/checkout | initiate recurring | `createRecurringSubscription` (Phase 4) |
| POST /api/customer/subscriptions/confirm-checkout | signed callback verify (never activates) | `verifySubscriptionSignature` (Phase 4) |
| POST /api/customer/subscriptions/action | cancel/pause/resume | Phase-4 ops (ownership enforced) |

## Pages / components

- `app/(dashboard)/dashboard/subscription/page.tsx` → `SubscriptionOverview`
- `app/(dashboard)/dashboard/subscription/plans/page.tsx` → `PlansCatalog`
- `hooks/useSubscriptionCheckout.ts` — Razorpay subscription checkout
- Nav: `DashboardLayoutClient` new "Plans & Subscription" entry + quick action

## Reused (no duplicates)

Clerk auth (`@/lib/auth`), dashboard layout/nav, `serialize-prisma`, lucide
icons, existing invoices page, Razorpay script loader, Phase 1–6 services,
Phase-3 resolver + cache invalidation.