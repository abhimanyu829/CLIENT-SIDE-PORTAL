# Security — Phase 8

## Controls

- Zero-trust role fetch from DB in the guard (never JWT claims alone).
- SUB_ADMIN workforce validation + permission matrix at every endpoint.
- Customer/anonymous/banned → 401/403; forged ids cannot reach services.
- Admin lifecycle actions reuse Phase-4 ops with the admin as the audited actor
  (`{ byAdmin }` additive flag; RBAC gate is the authorization boundary).
- No "Mark as Paid" / “Force Successful” controls exist; activation only via
  verified webhooks.
- No plan/state bypass: every mutation runs through Phases 2/4 services with
  their validation, transitions and concurrency rules.
- Audit: sensitive operations log to the existing AuditLog (actor, action,
  resource, sanitized after-state) via the phases' audit paths. Read-only view;
  audit rows are never editable/deletable through the UI.
- Sensitive data minimized: provider secrets, webhook signatures, raw payloads,
  credentials never leave the server; detail/audit payloads are sanitized
  (`sanitizeJson` strips secret/signature/token/password keys).
- Metrics deltas are per-state counts; nothing labeled as revenue (Phase 10).

## Tests

- `admin-subscription-guard.test.ts`: 5 RBAC negative/positive cases.
- `admin-subscription-service.test.ts`: metrics accuracy, issue aggregation
  kinds, audit sanitization, no commerce mutation surfaces (structural),
  protected one-time Razorpay routes + Phase-7 pages preserved.