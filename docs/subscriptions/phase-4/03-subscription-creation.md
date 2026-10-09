# 03 — Subscription Creation (Phase 4)

## Flow

```
authenticated customer (Clerk session; owner never client-supplied)
  → load published PlanVersion + assert billable
  → ensure RazorpayPlanMapping (existing or created)
  → compute total_count / quantity server-side
  → reserve internal UserSubscription (TRIALING, environment, version link)
  → provider subscriptions.create({ plan_id, ... }) with timeout
  → persist razorpaySubscriptionId
  → safe result { internalSubscriptionId, razorpaySubscriptionId, ... }
```

## Safety

- Owner: passed from the verified session only; empty/forged owner rejected.
- Cost fields: never read from the request; plan id forced from the mapping.
- Provider call AFTER the internal record is reserved; provider timeout leaves a
  TRIALING record with no remote claim (metadata `pending`).
- Provider success + DB persist failure → `BILLING_RECONCILIATION_REQUIRED`
  (a retry cannot create a duplicate remote subscription).
- Duplicate create requests find the existing (userId, planVersionId) record and
  return it instead of creating a second remote subscription.

## Checkout response

Returns only the internal + provider subscription ids and status. Never returns
secrets, Key Secret, webhook secret, or environment internals. `TRIALING` is the
maximal state a creation can produce — creation alone never proves billing.