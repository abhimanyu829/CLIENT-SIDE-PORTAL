# 01 — Commerce Audit (Phase 1)

Audit of the EXISTING standalone purchase system, performed before any code change. Source of truth = repository code, not assumptions.

## Standalone purchase lifecycle (Path A)

```
Cart (/api/cart, Cart/CartItem models)
  → Checkout (/checkout page → CheckoutClient)
  → POST /api/payments/checkout  OR  gateway-specific order routes
  → lib/services/enterprise-commerce-service.ts  (core $transaction orchestrator, ~1500 lines)
      · Order + OrderItem
      · Payment (gateway-tagged; optional subscriptionId)
      · Invoice upsert (keyed by paymentId)
      · CustomerEntitlement (per item; subscriptionId optional)
      · Subscription created ONLY for recurring tiers (interval != ONE_TIME/LIFETIME)
      · Vendor payout counters, metric events, notifications, email queue
  → Gateway fulfilment
      · Stripe: Checkout Session → /api/payments/stripe/webhook
      · Razorpay: /api/payments/razorpay/order → verify → webhook (HMAC)
      · PhonePe / Paytm: "Direct UPI manual" — PENDING order + UTR proof →
        admin manual verification (/api/admin/payments/verifications/*)
  → Access: CustomerEntitlement (userHasProductAccess) + preview sessions
```

## Payment gateways found

| Gateway | Type | Subscription coupling |
|---|---|---|
| Stripe | Real API + webhook | Creates/updates `Subscription`, can mark PAST_DUE/CANCELLED |
| Razorpay | Real API + webhook | Same |
| PhonePe | Manual UPI (no API) | None |
| Paytm | Manual UPI (no API) | None |
| Manual | Admin entry | None |

## Pre-existing subscription code (critical finding)

Three subscription-like systems already exist. Phase 1 formalizes **Stack A**:

- **Stack A (chosen): `Subscription` model** (schema ~line 910). Created by checkout
  (`enterprise-commerce-service.ts:1026`), Stripe webhook, Razorpay webhook. Lifecycle in
  `lib/services/subscription-service.ts` (666 lines, transactional, single source of truth).
  Syncs `CustomerEntitlement`. Has optional unique `stripeSubId`/`razorpaySubId`.
- Stack B: `UserSubscription` + `SubscriptionPlan`/`SubscriptionInvoice`/`SubscriptionPayment`
  (billing-center). Separate enums/tables. Untouched by Phase 1.
- Stack C: `ServiceSubscription` (services domain). Untouched by Phase 1.

## Auth / RBAC

Clerk (`proxy.ts` edge middleware: rate limits, route guards, admin permission headers).
Subadmin RBAC via `subadmin-permission-policy.ts`. Phase 1 reuses these; no new auth.

## Workers / events

BullMQ (`lib/workers.ts`): subscription queue already runs `expireOverdueSubscriptions`
every 5m and a reconcile job hourly. Event bus: `lib/services/event-bus.ts`.

## Verdict

Standalone commerce is complete and healthy. Subscription domain foundation exists in
Stack A but lacks: provenance (`source`), environment isolation, controlled-transition
enforcement. Phase 1 adds exactly those. Zero new tables.
