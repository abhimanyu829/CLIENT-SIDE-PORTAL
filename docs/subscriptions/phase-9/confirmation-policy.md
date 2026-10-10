# Confirmation Policy — Phase 9

## Risk classes

- **Class 1 — read**: plansList, summary, accessExplain, trialStatus,
  billingHistory. Identity + scope validation only.
- **Class 3 — customer-impacting mutations**: freeEnroll, trialStart,
  cancelRequest. The gateway's HIGH_RISK_MUTATION tier forces human approval;
  execution additionally re-validates owner scope immediately before dispatch.
- **Class 4 — high-impact admin**: not exposed (no admin-delegated identity).

## Confirmation binding

- Approval is requested through the existing approval engine
  (request → decision → SMS/human step-up paths already shipped in the
  gateway); the approval binds the capability, version, resource and input.
- A model-supplied `confirmed: true` cannot reach any adapter (strict schemas
  reject unknown keys) and is never treated as authorization.
- Cancel preflight (`checkResource`) runs at approval time; the same ownership
  check runs again during execution so a stale or substituted subscription
  cannot be acted on.
- Mutation idempotency comes from the backing services (dedupe keys,
  terminal-state rules), so approval/retry replay cannot double-execute.

## Human interaction

No agent-only paid checkout path exists: paid subscriptions require the
Phase-7 checkout with explicit customer consent. Trial/free enrollments and
cancellation require a real human approval via the approval engine; where the
product has no confirmation capture, the agent stops at preparation.