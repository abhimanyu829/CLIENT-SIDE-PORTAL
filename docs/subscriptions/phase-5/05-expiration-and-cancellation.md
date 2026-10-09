# 05 — Expiration & Cancellation (Phase 5)

## Expiration (`EXPIRATION`)

- Guard: if the subscription is ACTIVE and its verified period end is in the
  future, the operation is a no-op — a stale expiry job can never shorten a
  renewed period (mandatory test).
- Otherwise: expire only ACTIVE grants whose `expiresAt` has passed
  (`expireEntitlementGrant`, ACTIVE → EXPIRED).
- Permanent (null-expiry) grants and future-dated grants are untouched.

## Cancellation (`CANCELLATION_UPDATE`)

- Period-end (`cancelAtPeriodEnd`) → no change: grants ride out the paid-through.
- Immediate → revoke only this subscription's grants (ACTIVE/PENDING/SUSPENDED
  → REVOKED). EXPIRED/REVOKED rows are skipped (terminal, never re-transitioned).
- Never revokes standalone, admin, promotional or another subscription's grants.

## Pause / halt

- `PAUSE_UPDATE` → suspend ACTIVE subscription-sourced grants.
- `ACCESS_REVOCATION` → immediate full revocation of the exact source.
- Historical grant rows are preserved (no physical deletes).