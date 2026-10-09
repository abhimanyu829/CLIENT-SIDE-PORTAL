# 11 — Database Verification (Phase 5)

## Migration

`20261008040000_subscription_provisioning` applied to live Supabase
(2026-10-09): `ProvisioningOperation` + `ProvisioningStatus` enums,
`SubscriptionProvisioning` table with `dedupeKey @unique`,
`@@index([subscriptionId, status])`, `@@index([status, attemptCount])`,
`@@index([operation])`, FK `subscriptionId → UserSubscription(id) ON DELETE CASCADE`.

## Post-apply checks

- Drift (migrate diff vs live): only the pre-existing legacy `Catalog*` delta —
  zero Phase-5 drift.
- Live columns verified: `SubscriptionProvisioning.dedupeKey` (unique),
  `operation`, `status`, `attemptCount`, `periodEnd` present.
- Existing data intact: orders 27, UserSubscription 0, EntitlementGrant 2
  (prior verification evidence), SubscriptionProvisioning 0.

## Live behavior note

Representative live provisioning runs require a real activated merchant
subscription (Razorpay TEST round-trip — blocked on credentials, Phase-4
follow-up). The engine's DB interactions (idempotency, extensions, expiry,
source-separated revocation, no-partial-bundle) are exercised by the in-memory
suite, and the schema/constraints are verified above.