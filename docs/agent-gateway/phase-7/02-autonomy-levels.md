# Phase 7 — Autonomy Levels

Autonomy answers one question: within what pre-approved bounds may a connection act without a fresh human approval. It never grants access Phase 6 denied.

## Levels (most to least restrictive)

| Level | READ | LOW_RISK_WRITE | HIGH_RISK_MUTATION | CRITICAL |
|---|---|---|---|---|
| OBSERVE_ONLY | allow | deny | deny | deny |
| ASSISTED | allow | approval | deny | deny |
| APPROVAL_REQUIRED | allow | approval | approval | approval |
| LIMITED_AUTONOMY | allow | allow | approval | approval |
| FULL_SCOPED_AUTONOMY | allow | allow | allow | approval (mandatory) |

"allow" is still subject to the mandatory gates in `03-decision-model.md`.

## Default

A connection with no ACTIVE policy (none, disabled, superseded, or expired) runs at OBSERVE_ONLY with `maxRiskTier = READ`: reads may run, every mutation is denied.

## Policy fields (`AgentAutonomyPolicy`)

- `autonomyLevel`, `maxRiskTier` — validated on every read; an unknown value is `INVALID_AUTONOMY_POLICY` (deny).
- `allowedCapabilityIds` — optional allowlist; empty means no restriction beyond Phase 6.
- `approvalRequiredFor` — capabilities that always need approval for this connection, even READ.
- `environmentScope` — optional list of environments; outside it is `ENVIRONMENT_BLOCKED`.
- `resourceScopeReference` — optional `"<ResourceType>:<id>"` or `"<ResourceType>:*"`; outside it is `RESOURCE_OUT_OF_SCOPE`. Malformed is `INVALID_AUTONOMY_POLICY`.
- `expiresAt` — after it, the default applies.
- `version` — increments on every change; part of every approval binding.

## Administration

`GET/PUT/DELETE /api/admin/agent-connections/[id]/autonomy` — SUPER_ADMIN only, strict zod schema, actor id from the session. `PUT` creates version N+1 and supersedes N in one transaction; history is never edited. There is no MCP tool, capability or gateway route that reads or writes autonomy policy.

## No cache

`loadEffectiveAutonomyPolicy` reads Postgres on every gated call (one indexed lookup on `connectionId, status`). A downgrade takes effect on the next call; there is no stale-cache window.
