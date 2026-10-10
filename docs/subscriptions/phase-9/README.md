# README — Phase 9: AI-Agent Subscription Governance

## Objective

Expose approved subscription capabilities to authorized AI agents through the
existing Agent Gateway — typed, permission-controlled, owner-scoped, audited.
The agent is an interface; Phases 1–8 services remain authoritative.

## Delivered

- 8 new capabilities (5 READ, 3 HIGH_RISK_MUTATION) registered in the Phase-3
  manifest + 8 adapters wired into the Phase-4 adapter registry.
- READ tools: `subscriptions.plansList`, `subscriptions.summary`,
  `subscriptions.accessExplain`, `subscriptions.trialStatus`,
  `subscriptions.billingHistory`.
- Mutation tools (mandatory approval via the gateway's HIGH_RISK_MUTATION
  gate): `subscriptions.freeEnroll`, `subscriptions.trialStart`,
  `subscriptions.cancelRequest`.
- Owner scoping via the trusted machine identity (`context.ownerId`) — never a
  model-supplied field.
- No arbitrary SQL/Prisma/shell/provider access; every tool delegates to an
  existing Phase 3–6 service.

## Not delivered (documented limits)

- Agent-initiated paid checkout (customer must use the Phase-7 checkout with
  explicit consent).
- Administrator-copilot tools (no admin-delegated agent identity exists).
- Direct entitlement grant/revoke, payment bypass, plan publishing — forbidden.

Dependencies: Agent Gateway (Phases 3–4 infra), Phases 2–6 services, customer
view service (Phase 7), Phase-8 services untouched.