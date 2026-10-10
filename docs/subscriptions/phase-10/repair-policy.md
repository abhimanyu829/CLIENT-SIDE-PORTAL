# Repair Policy (Phase 10)

## Modes

| Mode | Behavior |
|---|---|
| DETECT_ONLY | scan + findings only. Default, and the only scheduled mode. |
| DRY_RUN | full detection + `ACTION_PROPOSED` status for eligible findings; zero mutations |
| SAFE_AUTO_REPAIR | executes ONLY the allow-list below; verifies postcondition |
| APPROVED_REPAIR | admin-triggered (`POST …/reconciliation {action:"repair"}`); same allow-list, audited with actor |
| MANUAL_INVESTIGATION | findings marked ESCALATED; no mutations |

## Allow-list (exact; each idempotent via its existing service)

| Action | Service | Postcondition (verified) |
|---|---|---|
| REPROCESS_PROVISIONING | Phase-5 `provisionSubscription` (same dedupe identity: subscriptionId+operation+periodRef) | `SubscriptionProvisioning.status === SUCCEEDED` |
| EXPIRE_STALE_TRIALS | Phase-6 `expireExpiredTrials` | trial `status === EXPIRED` |
| EXPIRE_STALE_GRANT | Phase-3 `expireEntitlementGrant` (CAS) | grant `status === EXPIRED` |
| REVOKE_SUBSCRIPTION_GRANTS | Phase-5 `ACCESS_REVOCATION` op (source-bound: exact subscription ref only) | target grant no longer ACTIVE |

Anything not in the list → `ESCALATED`/detection-only. Never: mark payments
successful, create payments/invoices, rewrite history, replay webhooks, set
subscription status directly.

## Safety

- Current state revalidated immediately before each repair (stale-scan defense).
- Failures → finding `FAILED` with note; counters surface errors on the run.
- Resolution only after postcondition; queued ≠ resolved.
- Repairs audit: `RECONCILIATION_REPAIR_APPLIED` (action, operationRef, verified).