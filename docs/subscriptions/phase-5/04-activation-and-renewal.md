# 04 — Activation & Renewal (Phase 5)

## Activation (`INITIAL_ACTIVATION`, `RESUME_UPDATE`)

Only when the subscription is **ACTIVE** (verified billing). Creates one grant
per plan item for the verified period `[currentPeriodStart, currentPeriodEnd)`
(mapped from Phase-4 timestamps, UTC). TRIALING/PENDING-less states are refused;
creation/checkout/browser events can never provision.

## Renewal (`SUCCESSFUL_RENEWAL`, `PERIOD_EXTENSION`)

- Loads the ACTIVE subscription-sourced grants for the subject.
- New item keys → create grants (idempotent).
- Existing keys → `extendEntitlementGrant(id, newPeriodEnd)` ONLY when the new
  verified end is strictly later; equal/earlier → skip (never shrink).
- No duplicates: same logical grant is extended, not cloned.
- Renewal after expiry → expiration already terminated the grant; the renewal
  path creates a fresh grant for the new period via the grant service.

## Failed / pending payments

`PAYMENT_HALT_UPDATE` performs NO extension — existing grants ride out their
verified paid-through period and expire at the boundary (EXPIRATION op/worker).
No grace-period engine is built here (later phase).