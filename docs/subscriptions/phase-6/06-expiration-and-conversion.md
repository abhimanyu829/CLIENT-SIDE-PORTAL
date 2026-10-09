# 06 — Expiration & Conversion (Phase 6)

## Expiration

- Read-time: `isTrialExpiredAt` + grant `expiresAt` deny at the 14-day
  boundary — cleanup is never required for denial.
- Cleanup: `expireExpiredTrials` flips EXPIRED and expires the exact grants;
  idempotent; cannot shorten a renewed/converted future.
- A late/duplicated worker run is a no-op.

## Conversion (coordinated, not new billing)

`confirmTrialConversion(trialId)` requires BOTH authoritative signals:
1. Phase-4 verified ACTIVE paid subscription for the same plan version
   (`userSubscription.status = ACTIVE`), AND
2. Phase-5 provisioned SUBSCRIPTION-source grant for that subscription.

Only then: trial → CONVERTED (grants retired AFTER paid grants exist — no
access gap). No checkout click, no pending payment, no unverified state ever
converts. Conversion + expiration race resolves deterministically (terminal
trials cannot convert).

## No silent charging

Starting a trial creates no subscription, no payment mandate, no Razorpay
record (tested). Conversion requires the explicit Phase-4 checkout flow.

## Free fallback

Paid access ending does NOT auto-grant a free plan; it simply reveals the
remaining valid sources (standalone, free enrollment if any). No fallback
granting without an explicit enrollment.