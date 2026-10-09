# 06 — Idempotency & Recovery (Phase 5)

## Operation identity

`dedupeKey = sha256(subscriptionId | operation | periodRef)`.

`periodRef` is the verified Phase-4 event id (or stable period key) — timestamps
are never the identity alone. `SubscriptionProvisioning.dedupeKey @unique`.

## States

PENDING (default) / PROCESSING / SUCCEEDED / FAILED_RETRYABLE / FAILED_PERMANENT.
Transitions are server-side only; duplicate-processing protection via the unique
key; SUCCEEDED replays return `{ duplicate: true }` with the recorded result.

## Retry classification

- RETRYABLE: transient DB/read failures (record FAILED_RETRYABLE, attemptCount
  increments; a retry reuses the SAME record and identity — no duplicate grants).
- PERMANENT: missing subscription/version, DRAFT version, invalid owner,
  environment mismatch, unsupported item, missing definition. Never endlessly
  retried; fix the catalog/mapping and use a new period reference.

## Delivery path

Phase-4 webhook → `scheduleProvisioning` (BullMQ `PROVISION_SUBSCRIPTION` with
jobId = dedupeKey, attempts 5, exponential backoff). Lazy queue unavailable →
synchronous execution (documented dev/test path). Worker branch
`processProvisioningJob` reuses the existing infrastructure.