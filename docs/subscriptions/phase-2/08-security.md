# 08 — Security (Phase 2)

## Threats & controls (all covered by Test Group E / F, and unit tests)

| Threat | Control |
|---|---|
| Forged plan id | `getPlan`→null; `validatePlan`/`publishPlan`/`pause`/`resume`/`archive`→`Unknown plan` |
| Forged owner/team/admin | Strict schemas reject `ownerId`/`teamId`/unknown keys |
| Forged status | `status` key rejected; status is server-derived only |
| Forged published version | `currentVersionId` rejected on create; publish sets it server-side |
| Arbitrary item reference | Referential types require an existing resource; non-referential must not carry `itemRefId` |
| Invalid foreign resource | `resolveItemReference` verifies Product/ServicePage/AIAgent existence |
| Unauthorized publish | `assertPlanTransition` + validation fail-closed; publish is a service call, not a raw write |
| Unauthorized archive | Terminal-state guard; illegal transitions throw |
| Published-version mutation | `isEditableVersionStatus` gate on every content mutation |
| Cross-tenant plan access | No tenant field is trusted; the catalog is global/platform-scoped, accessed only via services |
| Arbitrary DB / table update | Catalog service only touches `subscriptionPlan`/`planVersion`/`planItem`/`auditLog`; fake DB traps prove no commerce access |
| Duplicate slug race | `SubscriptionPlan.slug @unique` + pre-check + DB backstop |
| Concurrent publish/edit | Compare-and-set `updateMany where status`; one DRAFT version rule |
| Object injection | `z.record(z.unknown())` only for `metadata`/`config`; no spread of raw input into writes |

## Trust model

- Status, version numbers, `currentVersionId`, `catalogRevision` are server-derived.
- External callers pass only validated scalars; the service resolves references,
  builds the data objects explicitly (no `...input` spread into a write).
- Audit: every mutation writes an `AuditLog` row (`PLAN_CREATED`,
  `PLAN_HEADER_UPDATED`, `PLAN_VERSION_DRAFT_CREATED`, `PLAN_ITEM_ADDED`,
  `PLAN_PUBLISHED`, `PLAN_PAUSED`, `PLAN_RESUMED`, `PLAN_ARCHIVED`, …).
- `AuditLog.userId` references `User(id)` → the actor must be a real user (verified
  live; documented as a constraint for callers).

## Not present

No entitlement granting/checking, no provider APIs, no webhook handling, no
credential storage, no payment logic.
