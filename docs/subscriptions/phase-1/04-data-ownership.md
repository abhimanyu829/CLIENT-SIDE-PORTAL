# 04 — Data Ownership (Phase 1)

## Trusted owner

The commercial owner of a Subscription is the existing `User` (Clerk identity synced to
Prisma `User`). Phase 1 does NOT create a Customer/Team/Organization model.

- `Subscription.userId` — required FK to `User`. Server-resolved, never trusted from input.
- Team/org reference: NOT added. No genuine Phase-1 need; revisit only if a later phase
  introduces team billing with a concrete requirement.

## Ownership rules

1. `createFoundationSubscription` verifies the owner exists and is not banned
   (`db.user.findUnique`). Unknown/banned owner → `SubscriptionValidationError`, no row.
2. `getSubscriptionForOwner(subscriptionId, ownerId)` — denial-by-default read.
   Missing record and not-owned both return `null` (anti-enumeration: indistinguishable).
3. `transitionSubscriptionStatus` is an INTERNAL server-side API, called only from
   authenticated admin routes / verified webhooks / cron with a real actor id.
   External surfaces use the owner-scoped read path.

## Client-trust rules (all enforced, all tested)

- Forged customer/owner ID → rejected (unknown owner).
- Forged subscription ID → `null` / validation error; no data leak.
- Forged status (`status` key in input) → rejected by strict zod schema (unknown key).
- Forged provider IDs (`stripeSubId`/`razorpaySubId` in input) → rejected (unknown keys).
- Forged environment label → rejected (controlled set).
- Cross-user/cross-tenant read → `null`.
- Direct DB mutation from clients → impossible (no route exposes raw writes; all writes
  go through guarded service functions).

## Actor accountability

Every guard refusal logs via Pino (`subscription-service: blocked invalid status transition`
with subscriptionId, from, to, operation). Every successful CAS transition writes an
`AuditLog` row (`SUBSCRIPTION_STATUS_TRANSITIONED`) inside the same transaction.
