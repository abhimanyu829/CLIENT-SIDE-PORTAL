# 09 — Idempotency & Recovery (Phase 4)

## Prevents

| Risk | Mechanism |
|---|---|
| duplicate Razorpay plans | `@@unique([planVersionId, environment])` + reuse ACTIVE mapping |
| duplicate remote subscriptions | dedupe check on existing (userId, planVersionId) record |
| duplicate webhook processing | `WebhookEvent.eventId @unique` (durable accept-once) |
| duplicate charge records | `razorpayPaymentId @unique` + `providerEventId @unique` |
| duplicate lifecycle transitions | CAS/transition guards (same-state no-op) |
| concurrent cancel conflicts | ownership load + idempotent terminal handling |
| retry after timeout | typed PROVIDER_TIMEOUT → no blind repeat, reconciliation flag |

## Timeout / uncertain-result policy

- Provider request times out → typed error; internal record stays TRIALING with
  `metadata.pending`, no provider claim; a retry safely finds the reserved
  record (no duplicate).
- Remote plan created but mapping persistence failed → reconcile required; the
  operation refuses to create a second remote plan.
- Remote subscription created but id persistence failed → reconcile required.

## Webhook durability model

1. Verify signature.
2. Validate payload schema.
3. Persist `WebhookEvent` PENDING (durable acceptance) — unique eventId.
4. Process (state/charge/events).
5. Mark PROCESSED.
Failure in step 4 → FAILED + rethrow 500 (retryable by provider; re-delivery is
idempotent because the event exists). Failure before step 3 → nothing persisted,
raw retry.