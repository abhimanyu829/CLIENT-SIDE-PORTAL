# Phase 10 — Connection Management

Connections are managed through the **existing Phase 2 routes and service**; governance only adds the pages.

| Operation | Route | Behaviour |
|---|---|---|
| Register | `POST /api/admin/agent-connections` | owner validated server-side; credential (bearer token, or key id + signing secret) in this response only, shown once in a dialog; stored as a hash (+ AES-GCM for signing secrets) |
| Suspend | `POST …/[id]/suspend` | agent refused on its next request; pending approvals cancelled |
| Reactivate | `POST …/[id]/reactivate` | approvals stay cancelled |
| Rotate | `POST …/[id]/rotate` | new credential shown once; the old one stops working in the same transaction |
| Revoke | `POST …/[id]/revoke` | terminal; credentials revoked, approvals cancelled, every trigger of the connection revoked (Phase 9 addition) |

All four lifecycle actions are confirmed in the UI; revoke is marked destructive.

## Concurrency

Lifecycle commands are **idempotent target states** guarded by the Phase 2 state machine, not versioned edits: repeating one is a no-op, an illegal one (e.g. suspend a revoked connection) is `409 ILLEGAL_STATE_TRANSITION`, and rotation re-checks the status inside its transaction (revoke always wins a race). That is the appropriate concurrency control for a state machine; versioned optimistic concurrency is used for configuration (triggers, policies, autonomy).

## What the pages show

`ConnectionAdminView` / `CredentialAdminView`: name, provider, owner, team, environment, status, auth method, timestamps; credential **fingerprint**, key id, status, timestamps. Never `secretHash` or `signingSecretRef`.

## Tests

`p10-governance-routes.test.ts` B (create: once, hashed, authenticates, absent from views and audit; suspend / reactivate / rotate / revoke with authentication checks and trigger cascade; 409 after revoke), `p10-governance-ui.test.ts` (actions follow the state; no secret in any page), cross-phase Scenario 8, master E2E steps 1–2 and 18.
