# Phase 10 — Trigger Management

All trigger writes go through the Phase 9 `TriggerService`; governance adds the routes, the UI, optimistic concurrency end to end and audit entries.

| Operation | Route | Body |
|---|---|---|
| Create (DRAFT) | `POST /api/admin/agent-governance/triggers` | Phase 9 `createTriggerSchema` (strict) |
| Edit (DRAFT / PAUSED / DISABLED only) | `PATCH …/triggers/[ref]` | `{ expectedVersion, patch }` — patch is Phase 9 `updateTriggerSchema` (strict; type, connection and capability are immutable) |
| Activate | `POST …/[ref]/activate` | `{ expectedVersion, reason? }` |
| Pause / Resume / Disable / Revoke | `POST …/[ref]/pause` · `/resume` · `/disable` · `/revoke` | `{ expectedVersion, reason? }` |
| Rotate webhook secret | `POST …/[ref]/rotate-secret` | `{ expectedVersion, reason? }` — new secret in the response only |

- Owner, team and environment always come from the connection; forged fields are rejected (`400 TRIGGER_VALIDATION_FAILED`).
- Every action carries the version shown on the page. Stale → `409 CONFLICT`; illegal for the current state → `409 TRIGGER_INVALID_TRANSITION`; two administrators acting on the same version → exactly one wins (tested).
- Creating is confirmed and produces a draft: nothing fires until a separate, confirmed activation. Disable, revoke and rotation require a reason; revoke is destructive.
- Audit: `AGENT_TRIGGER_CREATED`, `AGENT_TRIGGER_UPDATED` (changed field names only), `AGENT_TRIGGER_STATUS_CHANGED`, `AGENT_TRIGGER_SECRET_ROTATED` (secret version only).

## Trigger page

Configuration, upcoming occurrences (schedules), endpoint and secret version (webhooks), the fixed capability input, actions allowed in the current state, the edit form when the trigger cannot fire, and the paginated run history (outcome, reason code, linked task and its status).

## Tests

`p10-governance-routes.test.ts` H (secret once and never stored / audited in clear, forged fields, schedule bounds, lifecycle + conflicts + race, edit rules, rotation, body limits), views H (run pages, webhook stats, schedules in timezone), cross-phase Scenarios 3–5 and 10, master E2E steps 9–16.
