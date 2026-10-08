# 08 — Cache Strategy (Phase 3)

## Principles

- CACHE IS NOT THE SOURCE OF TRUTH. The DB is authoritative.
- Deterministic keys, bounded TTL, explicit invalidation.
- Security-sensitive failures (Redis down, invalidate failure) never yield an
  unsafe ALLOW.

## Key

```
entitlements:v1:{environment}:user:{userId}
entitlements:v1:{environment}:team:{teamId}
```
Environment from `currentSubscriptionEnvironment()`; no user-controlled data in
keys.

## Behavior

- Miss → resolve from DB → `cacheSet` with TTL 60s.
- Hit → revive dates → STILL re-apply status/time rule at read time. A stale
  payload whose `expiresAt` passed is DENIED on read; a corrupted/forged cache
  row cannot grant revoked or expired access.
- Redis unavailable → `cacheGet` returns null, `cacheSet` no-ops → resolver falls
  back to the DB (authoritative). DB errors surface as typed failures
  (`ENTITLEMENT_SERVICE_UNAVAILABLE`), never as ALLOW.
- Snapshot semantics within TTL: grants written WITHOUT service invalidation are
  invisible until TTL expiry — deterministic.

## Invalidation

`invalidateEntitlementCache(subject)` (shared cache-service `invalidateCache`)
fires after:
- grant, revoke, suspend, restore
- (planned) source change — Phase 5 production events reuse the same helper

Reused the existing cache-service/Redis architecture — no second event system.

## Safety test coverage

`entitlement-cache.test.ts`: miss/hit snapshot, grant/revoke/suspend/restore
invalidation, Redis-unavailable fallback, stale-payload denial, key scoping.