# 01 — Provisioning Architecture (Phase 5)

## Position

Consumes TRUSTED internal subscription state (Phase 4's verified UserSubscription +
immutable bound PlanVersion + verified billing period) and translates it into
subscription-backed EntitlementGrants through the Phase 3 engine. It never touches
Razorpay, never reads raw provider webhooks, never grants without a verified signal.

```
Phase 4 webhook (billing only, signed)
  → applyProviderStatus / charge records
  → scheduleProvisioning({ subscriptionId, operation, periodRef: eventId })
        (BullMQ PROVISION_SUBSCRIPTION, deterministic jobId = dedupeKey)
Phase 5 provisionSubscription(op)
  → resolve UserSubscription (owner/status/period from DB only)
  → resolve immutable PlanVersion (bound at purchase; PUBLISHED or superseded-ARCHIVED)
  → validate ALL items + entitlement definitions (fail before any grant)
  → Phase 3 grantEntitlement / extendEntitlementGrant / suspend / revoke / expire
  → record SubscriptionProvisioning operation (unique dedupeKey)
  → invalidate effective-entitlement cache (Phase-3 helpers)
  → emit provisioning events
Phase 3 resolver → effective access (unchanged authority)
```

## Reuse (no duplicates created)

- Phase 3 `EntitlementGrant` + grant operations + resolver + cache invalidation
- Phase 4 `UserSubscription` + verified periods + Charge events
- Phase 2 `PlanVersion`/`PlanItem` + Phase-3 `describePlanItemEntitlement`
- Existing BullMQ `subscriptionQueue` + lazy queue conventions
- Existing event-bus, logger, audit conventions

## Files

- `lib/services/subscription-provisioning.ts` — the engine
- schema: `SubscriptionProvisioning` + `ProvisioningOperation`/`ProvisioningStatus`
- additive: `expireEntitlementGrant`/`extendEntitlementGrant` (Phase 3),
  `scheduleProvisioning` hook in the Phase-4 webhook processor,
  `PROVISION_SUBSCRIPTION` job + worker branch