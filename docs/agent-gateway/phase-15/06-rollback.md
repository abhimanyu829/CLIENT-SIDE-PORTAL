# Phase 15 — 06 Rollback

Three different "rollbacks", each with its own mechanism:

| What is rolled back | Mechanism | Phase |
|---|---|---|
| A release (who can use a capability) | rollout `rollback` to a lower stage, or `pause` | 15 |
| An agent's autonomy | `demote` to any lower level (immediate) | 15 |
| One executed write | capability-aware recovery through the gate as the original connection (`tickets.create` → `tickets.close`); irreversible operations are recorded for manual recovery | 11 / 13 |
| Everything, now | GLOBAL kill switch | 15 |

Rules shared by all of them: SUPER_ADMIN with a live session, a mandatory reason, optimistic concurrency, AuditLog + ledger evidence, and no path that bypasses Phase 6 / 7 for an agent operation. A kill switch also stops recoveries (they execute as the agent; master S12): deactivate the switch or recover manually.

Proof: `p15-release-service` H (rollback only downwards), L (demotion), master S11, S12, final E2E steps 15–17, 21.
