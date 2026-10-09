# 07 — State Mapping (Phase 4)

## Provider → internal

```
created/authenticated → TRIALING      (waiting for the first real payment)
active                 → ACTIVE
pending                → UNPAID
halted                 → PAST_DUE
paused                 → PAUSED
resumed                → ACTIVE
cancelled              → CANCELED     (terminal)
completed / expired    → EXPIRED      (terminal)
```

Uses the EXISTING Stack-B `SubscriptionStatus` enum — no second status enum was
created. Stack-A `SubStatus` (Phase 1) is untouched.

## Transition table (internal)

```
TRIALING → ACTIVE | UNPAID | PAST_DUE | PAUSED | CANCELED | EXPIRED
ACTIVE   → PAST_DUE | UNPAID | PAUSED | CANCELED | EXPIRED
UNPAID   → ACTIVE | PAST_DUE | PAUSED | CANCELED
PAST_DUE → ACTIVE | UNPAID | PAUSED | CANCELED
PAUSED   → ACTIVE | CANCELED
CANCELED → (terminal)
EXPIRED  → (terminal)
```
Same-state = idempotent no-op.

## Truth rules

- NEVER ACTIVE from creation, checkout opening, browser redirect or unverified
  callback. Only a verified `subscription.activated` (or provider-resumed)
  webhook moves a record to ACTIVE.
- Provider changes are applied with CAS + transition guard; unknown statuses are
  rejected (`WEBHOOK_PAYLOAD_INVALID`).