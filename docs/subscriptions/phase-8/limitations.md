# Limitations — Phase 8

## Unsupported (backend has no contract — not fabricated)

- Payment retry, refunds, card/payment-method management, plan
  migration/upgrade/downgrade, proration.
- Trial reset / extension / override and free-enrollment remediation write
  paths (Phase-6 management APIs don't exist; oversight is read-only).
- “Mark as paid” / force-successful-payment controls (by design — verified
  webhooks only).
- Financial totals/revenue reporting (Phase 10 reconciliation owns this; the
  dashboard shows only per-state record counts).

## Deferred

- Phase 9 AI-agent subscription governance; Phase 10 billing reconciliation and
  production hardening.

## Environment-dependent

- Live subscription-action round-trip and plan publish → provider mapping
  against a real Razorpay TEST account still blocked on Phase-4 credential
  acceptance (`401 Unauthorized`), deferred per user.
- Admin UI browser E2E requires a component-test harness the repo does not
  have; UI validated via typecheck, lint, and production build.