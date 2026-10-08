# 02 — Subscription Domain Boundary (Phase 1)

## Decision

**Option 1: formalize Stack A** (`Subscription` model + `subscription-service.ts`) as THE
subscription domain. No third stack. No rebuild. Additive only.

Rejected alternatives:
- New third Subscription model — would create three coexisting stacks.
- Unify A + B first — too large for Phase 1; touches billing-center (out of scope).

## Domain boundary

```
┌─────────────────────────────────────────────────────────────┐
│ SUBSCRIPTION DOMAIN (Stack A)                                │
│  lib/services/subscription-state-machine.ts   (pure)         │
│  lib/services/subscription-domain.ts          (foundation)   │
│  lib/services/subscription-service.ts         (lifecycle)    │
│  prisma: Subscription, SubStatus, SubscriptionSource         │
└─────────────────────────────────────────────────────────────┘
         ▲ optional reference only (never required)
┌────────┴────────────────────────────────────────────────────┐
│ STANDALONE COMMERCE (unchanged)                              │
│  Cart, CartItem, Order, OrderItem, Payment, Invoice,         │
│  CustomerEntitlement, enterprise-commerce-service.ts         │
└─────────────────────────────────────────────────────────────┘
```

## Invariants enforced

1. STANDALONE PURCHASE ≠ SUBSCRIPTION. Order/OrderItem/Cart have zero subscription fields.
   Payment.subscriptionId and CustomerEntitlement.subscriptionId are OPTIONAL.
2. SUBSCRIPTION ≠ PAYMENT. No payment logic in the domain modules.
3. SUBSCRIPTION ≠ PRODUCT. Product holds no subscription FK; Subscription points at Product.
4. SUBSCRIPTION ≠ ENTITLEMENT. Entitlement sync stays in subscription-service (existing
   behaviour); the new foundation service grants NO entitlements.
5. Provider IDs are never primary keys. Internal cuid is the identity;
   `stripeSubId`/`razorpaySubId` remain optional unique external references.
6. Status is server-controlled. No request body ever sets status on an existing row.

## What Phase 1 explicitly does NOT contain

Recurring billing, provider subscription APIs, subscription checkout, plan/bundle builder,
entitlement/free-tier/trial engines, upgrade/downgrade flows, renewal processing, customer
or admin subscription UI, provisioning, reconciliation, analytics. Later phases.
