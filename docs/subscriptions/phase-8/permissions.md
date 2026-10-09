# Permissions — Phase 8

## Model (reused, additive)

New subadmin resource `SubscriptionGovernance` added to
`SUBADMIN_RESOURCES` with the existing action vocabulary
(`VIEW, CREATE, EDIT, DELETE, APPROVE, PUBLISH`). Route policies registered for
`/admin/subscription-admin` and `/api/admin/subscriptions-governance`.

## Mapping

| Operation | Required action |
|---|---|
| View overview / lists / detail / enrollments / issues / audit | VIEW |
| Create draft plan / new draft version | CREATE |
| Edit header / versions / items | EDIT |
| Publish / pause / resume plan; subscription cancel / pause / resume | PUBLISH (plans) / APPROVE (subscriptions) |
| Archive plan | DELETE |

## Enforcement (server-side only)

- SUPER_ADMIN: full access via role check.
- SUB_ADMIN: workforce session validation + `canUseSubadminPermission` at every
  endpoint; direct API calls cannot bypass (guard runs in every route handler).
- Customers / banned / anonymous: rejected 401/403.
- UI hides what the matrix denies, but hiding is not the boundary — the guard
  is.

## Tests

`admin-subscription-guard.test.ts` (5 tests): SUPER_ADMIN allow; SUB_ADMIN with
matching permission allow, without → FORBIDDEN; unrelated resource → FORBIDDEN;
customer/banned/anonymous → denied.