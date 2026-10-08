# 07 — Subscription Contract (Phase 3)

## What Phase 3 guarantees for Phase 5

Phase 5 (provisioning) will convert an activated subscription into grants. The
engine provides the pure translation contract NOW:

`describePlanItemEntitlement(planItem)` → stable descriptor:

| PlanItem | Entitlement key | Type |
|---|---|---|
| PRODUCT `<id>` | `product.<id>` | PRODUCT |
| SERVICE `<id>` | `service.<id>` | SERVICE |
| AI_CAPABILITY `<id>` | `ai.<id>` | AI_CAPABILITY |
| FEATURE `<key>` | `feature.<key>` | FEATURE |
| STORAGE | `limit.storage` (+ value/unit) | STORAGE |
| USER_LIMIT | `limit.team_members` | USER_LIMIT |
| ADMIN_LIMIT | `limit.admin_users` | ADMIN_LIMIT |
| RESOURCE_LIMIT `<key>` | `limit.<key>` | RESOURCE_LIMIT |
| SUPPORT `<key>` | `support.<key>` | SUPPORT |

## Version immutability

A published `PlanVersion` is immutable (Phase 2). Historical subscriptions keep
their meaning because provisioning references the exact version; the engine
never reinterprets a past subscription against a newer plan version.

## Provisioning flow (Phase 5, not implemented here)

```
activated subscription
  -> planVersion (immutable)
  -> planItems -> describePlanItemEntitlement() -> descriptors
  -> grantEntitlement({ ..., subjectType: USER, sourceType: SUBSCRIPTION,
      sourceReference: subscriptionId, ... })   // idempotent via dedupeKey
  -> effective access includes the new grants instantly (cache invalidated)
```

## No provider coupling

No Razorpay plan/subscription ids, no webhooks, no recurring logic. The contract
is provider-neutral by construction.