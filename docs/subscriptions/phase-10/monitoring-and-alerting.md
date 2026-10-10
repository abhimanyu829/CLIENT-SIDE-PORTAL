# Monitoring & Alerting (Phase 10)

## Available signals (existing stack: Pino structured logs + AuditLog + run/finding rows)

- Run metrics (query `ReconciliationRun`): runs completed/failed, scanned,
  findings, repaired, skipped (proposed/escalated), errors, duration
  (startedAt→finishedAt).
- Run logs: `reconciliation run failed` (logger.error with runId);
  `reconciliation finding processing failed`; `reconciliation repair failed`.
- Repair audit: `RECONCILIATION_REPAIR_APPLIED` in AuditLog.
- Existing worker/queue metrics remain the source for backlog/retry health.

## Suggested checks (implemented as data queries, NOT a new alert stack)

- Alert when a run status FAILED, or errorCount > 0 twice consecutively.
- Alert when CRITICAL findings remain NEW/ESCALATED > 24h (aging query on
  `lastObservedAt`).
- Alert when a FAILED webhook event exists > 1h.
- Alert when FAILED_RETRYABLE provisioning findings recur for the same entity
  across ≥3 runs (attemptCount growth).

## Honest limitation

No external alerting integration (PagerDuty/Slack/webhooks) exists in the repo;
the above are queryable thresholds + log-based signals. Standing up a real
alert pipeline is documented as an operational next step, NOT claimed as done.