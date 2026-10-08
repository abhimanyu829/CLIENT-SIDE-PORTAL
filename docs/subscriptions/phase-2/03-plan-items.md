# 03 — Plan Items (Phase 2)

## Model

`PlanItem` (child of `PlanVersion`):

| field | purpose |
|---|---|
| `itemType` | `PlanItemType` — what kind of composition entry |
| `itemRefKey` | NOT NULL durable identity within the version (referenced id, or stable key) |
| `itemRefId` | referenced resource id for referential types; NULL otherwise |
| `label` | optional human label |
| `quantity` | optional quantity (default 1) |
| `limitValue` / `limitUnit` | numeric limit for limit types (e.g. 20 GB, 5 users) |
| `config` | free JSON config |
| `sortOrder` | display order |

`@@unique([planVersionId, itemType, itemRefKey])` → database-level duplicate
prevention for EVERY item type (non-null key), plus service-level friendly errors.

## Item types (smallest practical set)

| Type | Kind | Reference |
|---|---|---|
| `PRODUCT` | referential | `Product.id` (verified) |
| `SERVICE` | referential | `ServicePage.id` (verified) |
| `AI_CAPABILITY` | referential | `AIAgent.id` (verified) |
| `FEATURE` | declared | key only |
| `STORAGE` | limit | value + unit |
| `USER_LIMIT` | limit | value + unit |
| `ADMIN_LIMIT` | limit | value + unit |
| `RESOURCE_LIMIT` | limit | value + unit |
| `SUPPORT` | declared | key only (e.g. "priority") |

## Rules

- A plan references resources; it never copies or UPDATES the Product/Service/AIAgent
  record. No price/status/stock/marketplace mutation.
- Referential types require an existing resource (`resolveItemReference`). Unknown
  id → rejected. Non-referential types must NOT carry `itemRefId`.
- Duplicates rejected: same `(itemType, itemRefKey)` twice, or a second singleton
  (`STORAGE`/`USER_LIMIT`/`ADMIN_LIMIT`/`RESOURCE_LIMIT`/`SUPPORT`).
- Items are only mutable while the version is `DRAFT`.
- The same Product may appear in many different plans (composition is not ownership).

## Duplicate semantics

- Referenced resource id is the key → one row per resource per version.
- Declared/limit types use an explicit or derived key (e.g. `storage`).
- Service checks give deterministic errors; the unique index is the backstop under
  concurrency.
