# 03 — Plan-Item Mapping (Phase 5)

## Mapping contract (reuses Phase-3 `describePlanItemEntitlement`)

| PlanItem | Entitlement key | Scope | Grant fields |
|---|---|---|---|
| PRODUCT `<id>` | `product.<id>` | RESOURCE (`resourceId`) | period |
| SERVICE `<id>` | `service.<id>` | RESOURCE | period |
| AI_CAPABILITY `<id>` | `ai.<id>` | RESOURCE | period |
| FEATURE `<key>` | `feature.<key>` | GLOBAL | period |
| STORAGE | `limit.storage` | GLOBAL | limitValue/unit + period |
| USER_LIMIT | `limit.team_members` | GLOBAL | limitValue/unit + period |
| ADMIN_LIMIT | `limit.admin_users` | GLOBAL | limitValue/unit + period |
| RESOURCE_LIMIT | `limit.<key>` | GLOBAL | limitValue/unit |
| SUPPORT | `support.<key>` | GLOBAL | period |

## Source traceability

Every grant: `sourceType = SUBSCRIPTION`,
`sourceReference = internal UserSubscription.id` (never provider ids, never
plan ids). Ownership derived from the subscription record; subject is always
`USER:<subscription.userId>`.

## Unsupported items

Unmappable item or missing/inactive definition → whole operation
`FAILED_PERMANENT`, no grants created, provisioning record carries the error.
An incomplete bundle is never marked provisioned.