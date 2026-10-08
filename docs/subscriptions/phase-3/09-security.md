# 09 — Security (Phase 3)

## Threat matrix (all covered by the Phase-3 suite)

| Threat | Control |
|---|---|
| Forged customer/owner/team ID | subject verified against `User` (incl. ban check) / `Team` before grant |
| Forged entitlement key | semantic key validation + definition existence + active check |
| Forged source / source reference | controlled `EntitlementSourceType` enum; non-empty reference |
| Unauthorized grant | grants only via the guarded service (no routes, no raw writes) |
| Unauthorized revoke | grant existence check + guarded transitions; unknown ids fail |
| Cross-tenant resolution | subject-scoped queries; USER never sees TEAM grants and vice versa |
| Cross-resource resolution | RESOURCE grants resolve only against their exact `resourceId`; OWNER grants do not resolve in resource queries |
| Client-controlled expiry | zod `z.date()` validation + `expiresAt > startsAt` require server-provided dates; strict schema rejects strings |
| Client-controlled status | `status` not an accepted input field anywhere |
| Client-controlled quantity/limits | strict schema; negative/zero rejected |
| Arbitrary DB mutation | service builds data objects explicitly; no input spread; commerce/plan fake-DB traps prove no cross-domain access |
| Stale revoked access | REVOKED/SUSPENDED/EXPIRED excluded at read time; revoke invalidates cache |
| Entitlement bypass via cache | read-time re-check of status + window on every resolution |

## Error model

Typed `EntitlementError` codes: `ENTITLEMENT_NOT_FOUND`, `ENTITLEMENT_INACTIVE`,
`ENTITLEMENT_EXPIRED`, `ENTITLEMENT_REVOKED`, `ENTITLEMENT_OUT_OF_SCOPE`,
`DUPLICATE_GRANT`, `INVALID_ENTITLEMENT`, `INVALID_SOURCE`, `UNAUTHORIZED_GRANT`,
`CONFLICT`, `ENTITLEMENT_SERVICE_UNAVAILABLE`. No SQL, stack traces, secrets or
unrelated tenant data leak.

## Tenant isolation

- Grants are created against a server-verified subject only.
- Resolver queries are always subject-scoped.
- Standing security test: attacker user cannot resolve victim's entitlements;
  team A cannot read team B's grants; other-tenant resource queries denied.

## Non-goals (explicit)

- NOT authorization (RBAC/agent policy untouched).
- NOT a way to publish/activate products (Product system keeps control).
- NO AI-agent grant power, no admin UI, no new roles.