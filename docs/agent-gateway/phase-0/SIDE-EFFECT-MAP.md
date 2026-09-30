# Phase 0 — Side-Effect Map

For each major mutation, the full chain of side effects as actually implemented (not idealized).

## products.update
```
Product.update
   ↓
ProductVersion.create (snapshot)
   ↓
AuditLog.create (PRODUCT_UPDATED)
   ↓ [transaction commits]
emitEvent(PRODUCT_UPDATED)  →  admin-dashboard Pusher channel; product-{id} channel; cache invalidation
   ↓
revalidateProductCaches()  →  tags: products/featured-products/home-products/pricing; paths: /admin/products, /, /products, /pricing, /products/{type}, /products/{slug}
```

## products.updateTier (price change)
```
ProductTier.update
   ↓
PricingHistory.create  (only if price actually changed)
   ↓
AuditLog.create (TIER_PRICE_CHANGED or PRODUCT_TIER_UPDATED)
   ↓ [transaction commits]
emitEvent(TIER_PRICE_CHANGED)  (only if price changed)
   ↓
revalidateProductCaches() + revalidateTag("pricing")
```

## subscriptions.cancel
```
Stripe API call (stripe.subscriptions.cancel) — OUTSIDE the transaction, happens first
   ↓
db.$transaction:
   Subscription.update (status → CANCELLED)
   syncEntitlementForSubscription (CustomerEntitlement update)
   AuditLog.create
   ↓ [commits]
emitEvent(SUBSCRIPTION_CANCELLED)
clearUserAccessCaches (Redis del)
```
**Note:** if the Stripe call succeeds but the DB transaction throws, the subscription is cancelled at Stripe but not in the local DB — a real, if narrow, consistency gap (see TRANSACTION-IDEMPOTENCY-ROLLBACK-MATRIX.md).

## refunds.process (processRefund)
```
Payment.status check (fails closed if already REFUNDED or not SUCCESS — pre-flight, no DB write)
   ↓
Gateway call: stripe.refunds.create() OR razorpay.payments.refund()  — OUTSIDE the transaction, before DB write
   ↓ [on success]
db.$transaction:
   Payment.update (status → REFUNDED)
   Invoice.update (status → REFUNDED, if exists)
   Order.update (status → REFUNDED, if orderId present)
   AuditLog.create (REFUND_PROCESSED)
   ↓ [commits]
emitEvent(REFUND_PROCESSED)
revokeUserAccessForOrder()  →  its own db.$transaction: CustomerEntitlement.updateMany + cancel linked Subscriptions
```

## deployment-center.advanceStatus
```
db.$transaction:
   ServiceDeployment.update (status, statusHistory, timestamps)
   PurchasedService.update (status, activationDate)
   ↓ [commits]
addTimelineEvent()  →  ServiceTimelineEvent.create  [OUTSIDE the transaction]
queueEmail() (on first transition only)               [best-effort, .catch(()=>{}) swallowed]
notifyCustomer()                                       [best-effort, swallowed]
pushServiceUpdate()  →  Pusher private-user-{userId} channel "service-update" event
```
**Note:** all four post-transaction side effects are fire-and-forget with swallowed errors — if any fails, the DB state change is not rolled back and the admin receives no error surface for it.

## admin.banUser
```
db.$transaction:
   User.update (isBanned, bannedAt, banReason)
   UserSession.deleteMany (if banning — invalidates all sessions immediately)
   AuditLog.create (USER_BANNED / USER_UNBANNED)
   ↓ [commits]
emitEvent(USER_BANNED / USER_UNBANNED)  →  admin-dashboard channel
```

## webhooks.stripe / webhooks.razorpay (inbound, not an outbound capability)
```
Signature verification (fails closed)
   ↓
WebhookEvent lookup by eventId — if status=PROCESSED, short-circuit (idempotency)
   ↓
WebhookEvent.create/update (status → PENDING)
   ↓
Per-event-type handler  →  calls into subscription-service.ts / enterprise-commerce-service.ts
   (each handler has its OWN transaction boundary — not one outer transaction for the whole webhook)
   ↓ [on success]
WebhookEvent.update (status → PROCESSED)
   ↓ [on failure, up to 5 attempts]
WebhookEvent.update (status → FAILED, then DEAD after 5th) → emitEvent(WEBHOOK_DEAD)
```

## Cross-cutting observation

The overwhelming majority of "post-mutation" side effects (Pusher push, email queue, notification, revalidate) happen **after** the DB transaction commits and are wrapped in swallowed try/catch. This is a deliberate and reasonable pattern for a human-driven admin panel (the mutation itself is safe even if the notification fails). For the Agent Gateway, this means: **the audit trail for "what actually happened downstream of an AI-triggered mutation" cannot rely on these side effects succeeding** — the `AgentAuditLog` must capture success/failure at the DB-transaction boundary specifically, not assume the full side-effect chain completed.
