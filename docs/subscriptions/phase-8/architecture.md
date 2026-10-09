# Architecture — Phase 8

## Routes

Page: `/admin/subscription-admin` → `GovernanceWorkspace` (tabbed sections:
Overview, Subscriptions, Plan Catalog, Free & Trial, Operational Issues, Audit
History). Admin nav entry added to `AdminLayoutClient`.

API (all gated by `adminSubscriptionGate`):

| Route | Reads | Permissions |
|---|---|---|
| GET /api/admin/subscriptions-governance/overview | metrics | VIEW |
| GET …/subscriptions | list (filters/pagination) | VIEW |
| GET …/subscriptions/[id] | detail | VIEW |
| POST …/subscriptions/[id]/actions | cancel/pause/resume | APPROVE |
| GET/POST …/plans | list / create draft | VIEW / CREATE |
| PATCH/POST …/plans/[id] | header edit + ops (draft/new-version/items/validate/publish/pause/resume/archive) | EDIT / PUBLISH / DELETE |
| GET …/enrollments?type=trial\|free | oversight | VIEW |
| GET …/issues | operational failures | VIEW |
| GET …/audit | audit history | VIEW |

## Guard

`lib/admin-subscription-guard.ts`: session → DB role (zero-trust) → SUB_ADMIN
workforce validation → `canUseSubadminPermission(SubscriptionGovernance, action)`.
SUPER_ADMIN bypasses; customers/banned/anonymous rejected with 401/403 JSON.

## Reused services (no duplication)

`plan-catalog-service` (createPlan, updatePlanHeader, createDraftVersion,
updateDraftVersion, addPlanItem, removePlanItem, validatePlan, publishPlan,
pausePlan, resumePlan, archivePlan, listPlans); `razorpay-billing`
(cancel/pause/resume with additive `{ byAdmin }` — auth boundary stays the RBAC
gate; ownership check bypassed only for admins); `AuditLog` (existing);
`admin-subscription-service` (read-only query builder).

## Phase-4 minimal compatible integration

`cancelRecurringSubscription / pauseRecurringSubscription /
resumeRecurringSubscription` gained an optional `{ byAdmin?: boolean }` flag;
the owner assertion is skipped only when set, the admin id is the audited
actor, and the RBAC gate is the authorization boundary.