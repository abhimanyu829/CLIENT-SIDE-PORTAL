# 09 — Phase 3 Contract (Phase 2)

Contracts the entitlement/provisioning phases build on. They consume the catalog;
they do not modify it.

## 1. Catalog is the commercial source of truth

- A subscription will reference a `PlanVersion` (immutable published version), not
  a mutable plan. Never resolve entitlements from a plan's latest draft.
- `SubscriptionPlan.currentVersionId` names the currently effective version;
  historical versions remain readable (`ARCHIVED`).

## 2. Read contract for later phases

- `getPlan(idOrSlug)` — full detail with versions + items.
- `listPlans({ status, planType })` — deterministic ordering.
- A published version's `items` (with `itemType`/`itemRefId`/`limitValue`/`limitUnit`)
  is the definitional input for the entitlement engine.

## 3. Composition → entitlement mapping (definition only, Phase 3 decides policy)

- `PRODUCT` / `SERVICE` / `AI_CAPABILITY` items map to access grants for those
  resources.
- `STORAGE` / `USER_LIMIT` / `ADMIN_LIMIT` / `RESOURCE_LIMIT` items express limits.
- `FEATURE` / `SUPPORT` express declared capabilities.
- Phase 2 defines WHAT the plan promises; Phase 3 defines WHAT the customer has.

## 4. Lifecycle contract

- Only `PUBLISHED` plans are enrollable (Phase 3 must filter by plan status).
- `ARCHIVED` is terminal; historical subscriptions referencing archived versions
  must keep working (immutability guarantees this).
- `PAUSED` = not enrollable but resumable.

## 5. Provider contract (Phase 4)

- Provider (Razorpay) plan/price ids must be stored OUTSIDE this catalog (a mapping
  keyed by `PlanVersion.id`), never as the catalog identity.
- Commercial duration/billing interval are already expressed
  (`durationMonths` / `billingIntervalMonths`) for provider mapping.

## 6. Explicit non-contracts

Entitlement engine, free-tier/trial activation, subscription checkout, upgrade/
downgrade proration, renewal, provisioning, reconciliation, analytics — none are
built or promised here.
