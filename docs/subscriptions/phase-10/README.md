# README — Phase 10: Billing Reconciliation & Production Hardening

## Status

Implemented: reconciliation engine (bounded, mode-gated, idempotent) over the
existing billing/subscription/event/provisioning/trial evidence; allow-listed
repairs through existing Phase 3/5/6 services with postcondition verification;
admin API + governance-workspace section; scheduled DETECT_ONLY worker job;
audit records; docs. Settlement reconciliation explicitly UNSUPPORTED (no
verified settlement source — documented).

## Key rules

- Detect first, classify, then repair only what is provably safe and
  idempotent. No payment is ever created/marked successful; no financial
  history is rewritten; no second webhook processor exists.
- Authority matrix documented in `reconciliation-rules.md`.
- Modes: DETECT_ONLY (default/scheduled), DRY_RUN, SAFE_AUTO_REPAIR (4-item
  allow-list), APPROVED_REPAIR (admin-triggered per finding), MANUAL_INVESTIGATION.

## Dependencies

Phases 1–9 (state machines, provisioning, free/trial, entitlements, admin RBAC),
existing `subscriptionQueue`/workers, `AuditLog`, `WebhookEvent` inbox.

## Migration

`20261008060000_billing_reconciliation` (additive: 5 enums,
`ReconciliationRun`, `ReconciliationFinding`). Apply pending while Supabase
unavailable — see `testing.md`.