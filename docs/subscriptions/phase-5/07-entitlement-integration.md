# 07 — Entitlement Integration (Phase 5)

## Access authority stays Phase 3

The provisioning engine only WRITES grants through Phase-3 services. All reads —
`getEffectiveEntitlements` / `hasEntitlement` / `getEntitlement` / `getLimit` —
remain the resolver's job. No parallel access service, no parallel cache, no
parallel grant store.

## Source separation (mandatory, tested)

- Grant A (subscription) expires → grant B (standalone purchase, same key)
  stays effective.
- Subscription A expires → Subscription B's same-key grant stays effective.
- ACCESS_REVOCATION of one subscription never touches admin/promotional/other
  sources.

## Cache invalidation

Every grant mutation (create/extend/expire/suspend/restore/revoke) invalidates
the subject's effective-entitlement cache through the Phase-3 helpers, AFTER the
authoritative DB change. Cache is never the source of truth; no invalidation
failure can fabricate a success (resolver re-checks time/status on every read).

## Standalone preservation

Standalone commerce and its access records are untouched. Historic purchases are
never migrated into subscription grants. The overlap tests (`Group F`) are the
mandatory proof.