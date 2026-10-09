# README — Phase 8: SUPER_ADMIN Subscription Governance

## Scope

Internal administration workspace for subscription operations, built on the
existing admin dashboard and RBAC. Consumes Phases 1–7 services; no new
engines, no direct DB writes from the UI, no payment/provider bypass.

## Delivered

- Governance overview with accurate lifecycle metrics (paid active, pending
  activation, past due, paused, expired, scheduled cancellations, active
  trials, trials expiring ≤ 7d, free enrollments, provisioning/charge/webhook
  failures).
- Subscription search + filters + paginated list + detail (billing lifecycle,
  source-bound grants, provisioning operations, administrative history).
- Plan catalog governance: create draft, new draft version, header edits,
  version/item edits, validate, publish, pause, resume, archive — all through
  the Phase-2 service layer (published versions stay immutable).
- Free Forever + trial enrollment oversight (read-only).
- Operational issues (failed provisioning, failed charges, failed webhooks)
  in a sanitized timeline.
- Administrative audit history (read-only).

## Dependencies

Phase 2 plan catalog, Phase 3 entitlements, Phase 4 Razorpay billing, Phase 5
provisioning, Phase 6 free/trial, Phase 7 customer UI, existing admin layout,
`@/lib/admin-auth`, subadmin workforce matrix, `AuditLog`.

## Non-goals (deferred)

Phase 9 AI governance, Phase 10 reconciliation, payment retries, refunds, card
management, trial overrides, plan migration — unsupported by the backend;
documented in `limitations.md`.