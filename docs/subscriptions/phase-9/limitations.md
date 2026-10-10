# Limitations — Phase 9

## Unsupported (backend/identity has no contract — not fabricated)

- Paid subscription checkout via agent: requires the Phase-7 checkout with
  explicit customer consent; agents stop at preparation.
- Administrator-copilot tools: no admin-delegated agent identity exists in the
  gateway (machine identities are owner-bound); the optional admin section is
  therefore NOT registered.
- Direct entitlement grant/revoke, plan publication/pricing changes, refunds,
  payment bypass: forbidden — never exposed as tools.
- Trial reset/extension/override: Phase-6 has no such operation.

## Environment / infra

- Full gateway suite still carries the pre-existing 40-failure baseline
  (commit `125d2c5` product-mutation staleness) plus 4 surface-pin deltas from
  the Phase-9 capability expansion; `manifest.lock.json` refresh tooling
  absent — documented in testing.md.
- Live agent↔Razorpay round-trip blocked on the Phase-4 TEST-credential `401`
  (deferred per user).
- Browser/E2E harness absent; UI phases validated via typecheck/lint/build.

## Deferred

- Phase 10 reconciliation / production hardening: not implemented.