# Reconciliation Architecture (Phase 10)

## Flow

```
scheduled job (subscription.billing-reconcile, 6h, DETECT_ONLY)  or  admin API run
  → single-active-run guard (stale RUNNING >30min marked INTERRUPTED/FAILED)
  → run row (config: batchSize, thresholds, evidence mode)
  → bounded scans (batchSize ≤500): WebhookEvent, SubscriptionCharge,
    UserSubscription, SubscriptionProvisioning, EntitlementGrant, TrialEnrollment
  → pure rules (lib/services/reconciliation/rules.ts) → FindingDrafts
  → idempotent finding upsert (findingKey unique; RESOLVED findings re-detect → reopen NEW)
  → mode-gated repair (allow-list + current-state revalidation)
  → postcondition verification (domain read) → RESOLVED + repairOperationRef | FAILED
  → run counters + AuditLog (run completed / repair applied)
```

## Files

- `lib/services/reconciliation/rules.ts` — pure detection rules + thresholds.
- `lib/services/reconciliation/engine.ts` — run lifecycle, modes, repairs,
  `repairFindingById`.
- `app/api/admin/subscriptions-governance/reconciliation/route.ts` — GET
  (runs/findings), POST run/repair — RBAC via `adminSubscriptionGate` (VIEW/APPROVE).
- `components/admin/GovernanceWorkspace` — Reconciliation tab (runs, findings,
  Run/Dry-run/Safe-repair buttons, per-finding Repair).
- `lib/queue.ts` + `lib/workers.ts` — new repeatable job
  (`SUBSCRIPTION_JOBS.BILLING_RECONCILE`); existing RECONCILE job untouched.

## Reused (no duplicates)

Domain services for all repairs: `provisionSubscription` (Phase-5 idempotent
retry/revocation), `expireExpiredTrials` (Phase-6), `expireEntitlementGrant`
(Phase-3). Evidence comes only from existing inbox/charge/subscription/
provisioning/trial/grant records. Webhook signature boundary untouched.