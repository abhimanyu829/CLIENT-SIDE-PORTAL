# 05 — Entitlement Integration (Phase 6)

## Grants

- Free: `sourceType = FREE_PLAN`, `sourceReference = <FreeEnrollment.id>`,
  `expiresAt = null` (permanent; revoked only by authorized business action).
- Trial: `sourceType = TRIAL`, `sourceReference = <TrialEnrollment.id>`,
  `expiresAt = trialExpiresAt`.

All writes go through Phase-3 `grantEntitlement` / `expireEntitlementGrant`
(which dedupe, audit and invalidate the subject cache AFTER the DB commit).
The Phase-3 resolver remains the ONLY access authority — no parallel check
paths.

## Idempotency

- Free: `FreeEnrollment.dedupeKey` unique (customer+version); duplicates return
  the existing enrollment.
- Trial: scope key unique; grant creation itself is deduped by Phase-3.

## Source separation (mandatory, tested)

- Expiring/cancelling a trial expires ONLY its TRIAL grants.
- Standalone, FREE_PLAN, SUBSCRIPTION, ADMIN_GRANT and other-scope TRIAL grants
  survive.
- Overlap matrix (Standalone+Trial, Standalone+Free, Standalone+Paid,
  Trial+Paid, Free+Paid) verified independently.