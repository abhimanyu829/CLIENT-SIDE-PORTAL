# 02 — Plan Versioning (Phase 2)

## Why

A published commercial plan must not silently change the meaning of existing
subscriptions. Versioning freezes each commercial definition at publish time.

## Model

`PlanVersion` (child of `SubscriptionPlan`, `@@unique([planId, version])`):
- `version` (monotonic int), `status` (`PlanVersionStatus`), `price`, `currency`,
  `billingIntervalMonths`, `durationMonths`, `notes`, `createdBy`,
  `publishedAt`, `archivedAt`.

## Rules

- At most ONE `DRAFT` version per plan at a time (`createDraftVersion` refuses a
  second draft).
- All content mutations (`updateDraftVersion`, `addPlanItem`, `removePlanItem`)
  require `status = DRAFT`. `PUBLISHED` and `ARCHIVED` versions are immutable for
  content — edit by creating a new draft.
- Publishing a new version supersedes the previously published one:
  `PUBLISHED → ARCHIVED` (kept, readable, never mutated). The plan's
  `currentVersionId` moves to the new version.
- Version numbers are deterministic and monotonic (`max+1`).

## Flow

```
createPlan → plan DRAFT + version 1 DRAFT
  edit draft (header/items/pricing)
  publishPlan → version 1 PUBLISHED, plan PUBLISHED, currentVersionId = v1
createDraftVersion → v2 DRAFT
  edit v2
publishPlan → v2 PUBLISHED, v1 ARCHIVED (superseded, intact), currentVersionId = v2
archivePlan (any time) → plan ARCHIVED (terminal); DRAFT versions archived;
  PUBLISHED versions kept as historical record
```

## Immutability enforcement

- Service-level guards (`isEditableVersionStatus`).
- DB-level: `PlanVersion` has no update path exposed except draft-guarded service
  functions; `@@unique([planId, version])` prevents duplicate/forked versions.
- Publish uses compare-and-set (`updateMany where status = DRAFT`) → concurrent
  double-publish cannot both win.
