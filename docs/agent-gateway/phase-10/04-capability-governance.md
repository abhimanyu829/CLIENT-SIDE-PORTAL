# Phase 10 — Capability Governance

The capability catalog is **code**: the reviewed Phase 3 manifest, loaded into the registry singleton. It is the only source of truth for what a capability is, so the governance page is **read-only** — a database copy that could be edited would be a second source of truth and could drift from the code that actually executes.

What an agent may do with a capability is governed where Phases 6–7 put it:

| Lever | Where |
|---|---|
| allow / deny / require approval, by scope | Phase 6 policies (`/policies`) |
| per-connection allowlist, ceiling, always-approve list, environments | Phase 7 autonomy (connection page) |
| mandatory approval (critical, irreversible, financial, production deployment) | Phase 7 rules in code — shown, cannot be removed |
| asynchronous use | Phase 3 `async.asyncSupported` (code) |

## The page

For every registered capability (including disabled and forbidden ones): id@version, name, risk tier, exposure, status, asynchronous support and its derived retry class (`classifyRetry`), mandatory approval reason (`mandatoryApprovalReason` for this environment), reversibility, and live references: active policy versions naming it and live triggers using it. Filters: exposure, risk tier, async-capable only.

Only ACTIVE, AGENT_AVAILABLE, async-capable capabilities with an execution reference are offered when creating a trigger (`triggerableCapabilities`).

## Tests

`p10-governance-views.test.ts` C: the catalog equals the registry exactly; derived metadata; filters; reference counts follow live policies and triggers; trigger options are restricted. The route inventory test proves there is no capability mutation endpoint.
