# 02 — Plan-Version Resolution (Phase 5)

## Source of truth

`UserSubscription.planVersionId` — the immutable version BOUND AT PURCHASE by
Phase 4. Never the plan's "current" version, never the catalog slug/name.

## Rules

- Unknown subscription → `PROVISIONING_SUBSCRIPTION_NOT_FOUND` (permanent).
- Missing `planVersionId` → permanent.
- DRAFT versions → permanent (`never provisionable`).
- PUBLISHED and superseded (ARCHIVED) versions are both valid for historical
  subscriptions — a version that was published at purchase stays provisionable
  after the catalog moves on.
- Environment: `subscription.environment` must equal the current environment
  (legacy NULL = allowed; cross-environment → permanent).

## Immutability consequence

If Growth v2 later drops a product, v1 subscribers keep v1's items because the
engine always reads the BOUND version. Verified by test
`accepts superseded (ARCHIVED) versions for historical subscriptions`.

## Item validation (before any grant)

Every item is mapped via `describePlanItemEntitlement`; a missing/inactive
entitlement definition aborts the whole operation (`FAILED_PERMANENT`, zero
grants). No partial bundles are ever reported as success.