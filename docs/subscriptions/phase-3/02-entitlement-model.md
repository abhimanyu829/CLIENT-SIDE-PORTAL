# 02 — Entitlement Model (Phase 3)

## Definitions

`EntitlementDefinition` — stable catalogue of WHAT may be granted.

| field | meaning |
|---|---|
| `key` | UNIQUE stable business key: `product.school_management`, `feature.rag`, `ai.sales_agent`, `limit.storage`, `limit.admin_users`, `support.priority`. NOT model names / table names / UUIDs. |
| `type` | `EntitlementType`: PRODUCT, SERVICE, FEATURE, AI_CAPABILITY, STORAGE, USER_LIMIT, ADMIN_LIMIT, RESOURCE_LIMIT, SUPPORT (smallest needed set). |
| `resourceType` / `configuration` / `isActive` | optional resource context, policy config, activation flag. |

Validation rejects: duplicate key, unknown type, malformed config, unknown keys,
non-semantic keys (`CustomerEntitlement`, `a.b`, `UPPER.x`).

## Grants

`EntitlementGrant` — a concrete grant held by a subject:

| field | meaning |
|---|---|
| `entitlementDefinitionId` FK + denormalized `entitlementKey` | key for fast indexed resolution |
| `subjectType` USER / TEAM | tenant-aware subject |
| `subjectUserId` / `subjectTeamId` | exactly one, matching the type (server-verified against `User` / `Team`) |
| `sourceType` STANDALONE_PURCHASE / SUBSCRIPTION / ADMIN_GRANT / PROMOTIONAL | provenance |
| `sourceReference` | stable ref inside the source (orderId / subscriptionId / admin ref) |
| `scope` GLOBAL / OWNER / TEAM / RESOURCE | where the grant applies |
| `resourceType` / `resourceId` | RESOURCE-scoped grants |
| `quantity` / `limitValue` / `limitUnit` | limits |
| `status` PENDING / ACTIVE / SUSPENDED / EXPIRED / REVOKED | lifecycle |
| `startsAt` / `expiresAt` | time window (UTC) |
| `dedupeKey` UNIQUE | deterministic idempotency |
| `configuration` / `metadata` | per-grant data |

## Idempotency

`dedupeKey = sha256([entitlementKey, subjectType, subjectUserId, subjectTeamId,
sourceType, sourceReference, scope, resourceId])`. Identical provisioning
(webhook retries) returns the existing grant; no duplicate active grants.

## No duplicate access system

The engine never copies Orders/Products/Payments into a new table; the
standalone records stay the source of truth and are adapted at read time.