# Operations Runbook (Phase 10)

## Run reconciliation

- Admin → Subscription Governance → Reconciliation → "Run detection" (default).
- Use "Dry run" first for a new rule; "Safe auto-repair run" only after the
  dry-run findings look correct.
- Findings → "Repair" button applies the verified allow-listed repair for that
  finding (RBAC: SubscriptionGovernance APPROVE).

## Investigate a finding

1. Category + severity + observed/expected values (evidence).
2. Entity references: check the matching Phase-4/5/6 records (subscriptions,
   provisioning ops, grants, trials, webhook inbox).
3. INSUFFICIENT/EXTERNAL_PROVIDER_UNAVAILABLE findings: no action possible until
   provider credentials/evidence are configured — do not "fix" manually.

## Failed run

Run row shows `FAILED` + errorCode/errorMessage. Cause is logged with runId.
Fix the dependency (DB/Redis), then start a new run — runs are append-only.

## Recurring high-severity findings

Group by entity (index on entityType+entityId); escalate to manual
investigation; NEVER instruct operators to hand-edit statuses — use the Phase
4/5/6 services that own the state.

## Worker notes

- `subscription.billing-reconcile` runs every 6h, DETECT_ONLY, batchSize 200.
- Single-active-run guard: a stuck RUNNING row >30min auto-fails on next attempt.
- Existing `subscription.reconcile` job (expiry sweep) unchanged.