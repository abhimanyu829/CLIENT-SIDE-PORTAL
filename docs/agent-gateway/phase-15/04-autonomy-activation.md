# Phase 15 — 04 Autonomy activation

Guarded changes of one connection's Phase 7 autonomy level (`rollout/promotion.ts`, route `POST /api/admin/agent-governance/connections/[id]/autonomy`).

## Promotion: one level, every guard

Ladder: `OBSERVE_ONLY → ASSISTED → APPROVAL_REQUIRED → LIMITED_AUTONOMY → FULL_SCOPED_AUTONOMY`. A promotion never names a target (the body schema refuses one) and moves exactly one step. It is refused (`409`, `outcome: BLOCKED`, `autonomy.promotion_blocked` with the failed checks) when:

| Check | Failed check code |
|---|---|
| connection not ACTIVE | `CONNECTION_NOT_ACTIVE` |
| a GLOBAL or CONNECTION kill switch applies | `KILL_SWITCH_ACTIVE` |
| release controls unreadable | `RELEASE_CONTROLS_UNAVAILABLE` |
| connection health UNHEALTHY / UNAVAILABLE (service failure rate, circuit openings) | `HEALTH_FAILURE_RATE`, `HEALTH_CIRCUIT_OPENED`, `HEALTH_DATA_UNAVAILABLE` |
| any security event for the connection in the window (task violation, refused input, injection signal, blocked outbound) | `HEALTH_SECURITY_EVENTS` |
| target LIMITED_AUTONOMY or above without HEALTHY evidence (≥ 20 samples) | `HEALTH_INSUFFICIENT_EVIDENCE` |
| target FULL_SCOPED_AUTONOMY in production | `FULL_AUTONOMY_NOT_PROMOTABLE_IN_PRODUCTION` |

A successful promotion writes a new autonomy policy version (Phase 7 store, optimistic concurrency) keeping the risk ceiling, capability allowlist, approval list, environment and resource scope and expiry; it records `autonomy.promoted` (from, to, health verdict) and an AuditLog row.

## Demotion: immediate

To any lower level, with no guard (making an agent less autonomous is always safe), `autonomy.demoted`.

## Why security events block promotion

A connection whose agent sent hidden characters, triggered a task violation or carried injection signals in the last hour is not a candidate for more autonomy, regardless of its success rate. Security events are counted by connection (they are recorded before an environment is resolved; P15-B1).

Proof: `p15-release-service` L, master S20, final E2E steps 14 and 21.
