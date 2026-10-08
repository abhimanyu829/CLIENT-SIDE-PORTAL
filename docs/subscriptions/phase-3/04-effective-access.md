# 04 — Effective Access (Phase 3)

## Resolver surface

- `getEffectiveEntitlements(subject, options)` — normalized view of every valid
  grant from every source (see 06 for the standalone adapter).
- `hasEntitlement(subject, key, options)` — boolean ALLOW/DENY.
- `getEntitlement(subject, key, options)` — deterministic winning grant.
- `getLimit(subject, limitKey)` — resolved numeric limit.

`subject` is `{ type: "USER", userId }` or `{ type: "TEAM", teamId }`.

## Output shape (never raw DB rows)

```
EffectiveEntitlement {
  key, type, status, scope, quantity, limitValue, limitUnit,
  startsAt, expiresAt, sourceType, sourceReference,
  resourceType, resourceId, configuration
}
```

## Resolution rules

1. Load native grants (joined to definition for the type).
2. Load adapted standalone grants (USER subjects only).
3. Filter: status ACTIVE AND now >= startsAt AND (now < expiresAt OR expiresAt null).
4. Apply resource scope filter when `resourceId` requested: keep GLOBAL grants +
   RESOURCE grants for the exact resource; OWNER grants do not resolve as
   resource-scoped access.
5. Time/status re-check happens on EVERY read, cache or not — expiry and
   revocation can never be masked by stale cache.

## Team vs user isolation

A USER subject never sees TEAM grants; a TEAM subject never sees USER grants.
Tenant isolation is by subject identity, never by client-supplied scoping.

## Access formula at the application boundary

```
Access = Identity(actor)
       + Authorization(existing RBAC / agent policy)
       + Entitlement(hasEntitlement(customer, key, { resourceId? }))
       + Product availability (Product system)
```
The entitlement engine provides only the middle term and does not replace
authorization.