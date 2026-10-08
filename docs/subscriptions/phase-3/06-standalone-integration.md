# 06 — Standalone Integration (Phase 3)

## Compatibility layer, not migration

Standalone purchases keep their existing storage, checkout, payment and order
flows 100% unchanged. `CustomerEntitlement` (the existing access record) is
READ by the adapter and never written by the entitlement engine.

## Adapter behavior (`loadStandaloneGrants(userId)`)

- Reads `CustomerEntitlement` rows: `userId`, `status = ACTIVE`,
  `expiresAt IS NULL OR > now`.
- Translates each row to an effective entitlement:
  - key: `product.<productId>` (stable, deterministic)
  - type: PRODUCT
  - scope: OWNER
  - `startsAt` / `expiresAt` copied (expiry honored at read time)
  - source by provenance: `orderId` present → STANDALONE_PURCHASE;
    `subscriptionId` present → SUBSCRIPTION (pre-existing sync, read-only);
    neither → ADMIN_GRANT
  - `resourceId = productId`, quota surfaced as configuration
- Expired purchase access simply does not resolve — no cleanup dependency.

## Guarantees

- No migration of historical purchases into grants.
- Old customers stay resolvable.
- No duplicate access system; the adapter is the same read path, not a new store.
- `userHasProductAccess` (existing access check) is untouched and remains the
  app's direct access path where in use.

## Note

Existing `userHasProductAccess` continues to serve legacy call sites unchanged.
New surfaces should call `hasEntitlement(userSubject, "product.<id>")`, which
includes adapted purchase access plus native grants.