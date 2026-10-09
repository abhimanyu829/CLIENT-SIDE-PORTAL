# 04 — Trial Lifecycle (Phase 6)

## States (server-controlled)

```
PENDING → ACTIVE | CANCELLED
ACTIVE  → CONVERTED | EXPIRED | CANCELLED
CONVERTED / EXPIRED / CANCELLED = terminal
```

## Flow

1. `startTrial(userId, planId)` — validates, reserves scope, creates PENDING
   with `startedAt=now`, `expiresAt=now+14d`, provisions TRIAL grants from the
   bound plan version, transitions to ACTIVE.
2. Provisioning failure → stays PENDING with `provisioningError`; a retry
   resumes provisioning on the same enrollment (no duplicate), never reports a
   false successful activation.
3. Duplicate start while ACTIVE → `TRIAL_ALREADY_ACTIVE`.

## Grants

Every trial grant: `sourceType = TRIAL`,
`sourceReference = <TrialEnrollment.id>`, `expiresAt = trial expiresAt`
(identical boundary — the resolver denies at read time regardless of the
record's status or worker progress).

## Worker

`expireExpiredTrials()` (BullMQ `subscription.trial-expire`, 15m) marks
overdue ACTIVE trials EXPIRED and expires their exact grants. It is cleanup
only; the resolver's timestamp rule is the access truth. Idempotent, bounded,
tenant-aware.