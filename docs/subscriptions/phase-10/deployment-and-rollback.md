# Deployment & Rollback (Phase 10)

## Rollout sequence (backward-compatible)

1. Apply additive migration `20261008060000_billing_reconciliation`
   (`npx prisma migrate deploy`) — new enums + 2 new tables only; zero changes
   to existing tables → app/worker versions are compatible before/after.
2. Deploy app + workers together (same image). Old workers ignore the new job;
   new workers register `subscription.billing-reconcile`.
3. Verify: run appears in admin Reconciliation tab; first run is DETECT_ONLY.
4. Keep scheduled mode at DETECT_ONLY; enable SAFE_AUTO_REPAIR only per policy
   after reviewing dry-run output (documented in repair-policy.md).

## Queue compatibility

New job name only (`subscription.billing-reconcile`); no payload changes to
existing jobs → no drain required; workers can restart independently.

## Rollback

- App rollback: safe — the new tables are ignored by old code; findings/runs
  remain (append-only).
- Do NOT drop the Phase-10 tables on rollback (audit/history). A later re-apply
  resumes cleanly (idempotent findingKey upserts).
- In-progress runs are non-destructive (DETECT_ONLY default); a killed run is
  auto-failed by the stale-RUNNING guard.

## Post-deploy checks

- Run detection manually; confirm counts render; confirm no repair ran.
- Confirm existing `subscription.reconcile`/expiry jobs still fire (unchanged).
- Check Pino logs for `reconciliation run failed` = 0.