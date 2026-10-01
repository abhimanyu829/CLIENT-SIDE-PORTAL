# Phase 11 — 01 The agent audit ledger

The ledger is the platform's **evidence** of what agents did and what humans decided about agents. It is not an application log (pino), not telemetry (metrics, spans) and not the general admin `AuditLog`. It answers, after the fact and with integrity: who acted, as which identity, on what, under which policy and autonomy level, with which approval, with what result.

## Where it lives

| Piece | File |
|---|---|
| Table `AgentAuditEvent` (+ enums `AgentAuditCategory`, `AgentAuditOutcome`) | `prisma/schema.prisma`, migration `20261004000000_agent_gateway_phase11_audit_ledger` |
| Closed vocabulary (action → category) | `lib/agent-gateway/audit-ledger/types.ts` |
| Append, verify, read (the only module touching the table) | `audit-ledger/ledger.ts` |
| Digest / chain | `audit-ledger/digest.ts` (see `02-integrity-model.md`) |
| What may enter | `audit-ledger/redaction.ts` |
| How callers write (failure policy) | `audit-ledger/recorder.ts` |
| Read model for administrators | `governance/evidence.ts`, `/admin/agent-governance/ledger` |

Reused, not re-built: canonical JSON is the Phase 7 RFC 8785 serializer (`approvals/canonical-json.ts`); input digests are the Phase 7 `computeInputDigest`; the logger is the Phase 1 `gatewayLogger`. The existing `AuditLog` table is kept for admin mutations (Phase 2/10 write both); it was not reused as the ledger because it is mutable, unchained and has no agent fields.

## The event

Every row carries: `sequence`, server-generated `eventId` (`aud_` + 32 hex), `schemaVersion`, `category`, `action`, `outcome` (SUCCESS / DENIED / FAILED / INFO), `occurredAt`, `requestId`, `traceId`, actor (`AGENT` + connection id, `HUMAN` + user id, `SYSTEM`), connection / agent / owner / team, capability id + version, risk tier, resource type + ref, environment, authorization decision + policy ref (`<policyVersionId>@v<n>`), autonomy level + policy version, approval / task / trigger refs, adapter id, execution status, result / error code, `inputDigest`, `outputDigest`, allowlisted `metadata`, `previousEventDigest`, `eventDigest`.

Raw input and raw output are **never** stored — only their SHA-256 digests. No foreign keys: evidence must outlive, and never cascade from, the rows it describes.

## What is recorded, and by whom

| Category | Actions | Emitted by |
|---|---|---|
| AUTHENTICATION | `authentication.succeeded` (≤1/min/connection), `authentication.failed` (≤1/10 s per failure code) | `observability/request-evidence.ts` (MCP and HTTP pipelines) |
| IDENTITY | connection created / suspended / reactivated / revoked / expired, credential generated / rotated / revoked | `observability/lifecycle-events.ts` (Phase 2 service) |
| AUTHORIZATION | `authorization.allowed` / `denied` / `unavailable` | `execution-gate/observability.ts` (every gate decision) |
| APPROVAL | `approval.required` / `consumed` / `refused` (gate), `approved` / `rejected` / `cancelled` (human) | gate observability, `approvals/decision-service.ts` |
| AUTONOMY | `autonomy.policy_set`, `autonomy.policy_disabled` | `autonomy/policy-store.ts` (with the human actor) |
| EXECUTION | `execution.started` (intent, **strict**), `succeeded`, `failed`, `replayed` | `execution/resolver/adapter-resolver.ts` |
| TASK | created … timed_out; `security.task_violation` | `tasks/observability.ts` |
| TRIGGER / WEBHOOK / SCHEDULE | `trigger.fired`, `schedule.fired`, `webhook.accepted`, `webhook.rejected` (throttled) | `triggers/runtime.ts`, `triggers/webhook-handler.ts` |
| POLICY / ADMIN_GOVERNANCE | policy created / published / rolled back / enabled / disabled; trigger and task admin actions; `governance.ledger_verified` | `governance/audit.ts` |
| FAILURE | circuit opened / half-open / closed / rejected | `resilience/circuit-breaker.ts`, resolver |
| ROLLBACK | `recovery.requested` / `executing` / `succeeded` / `failed` / `approval_required` / `manual_required` | `recovery/service.ts` |
| SECURITY | `security.input_rejected` (tampered recovery evidence) | `recovery/service.ts` |

Reserved for later phases (vocabulary exists, emitters arrive with the feature): CAPABILITY (registry fingerprint, Phase 12), `security.injection_suspected` / `secret_redacted` / `outbound_blocked` (Phase 12), `autonomy.promoted` / `demoted` / `promotion_blocked`, `kill_switch.*`, `rollout.*`, `release.attestation_recorded`, `security.kill_switch_blocked` / `rollout_blocked` (Phase 15).

A stored result being polled back (`agent_task_status`, gate purpose `result_read`) is **not** recorded when allowed — one row per poll would be noise — but a denial of it is.

## Failure policy

| Kind | Function | Policy |
|---|---|---|
| Intent before a mutation | `recordAuditStrict` | If the ledger cannot take `execution.started`, the non-READ capability is **not executed** (`EXECUTION_UNAVAILABLE`, marked `dispatched: false`). No unaudited mutation. |
| Outcomes, decisions, lifecycle, admin changes | `recordAudit` | Best effort: never throws, never changes business state; a failure is counted (`agent_audit_append_total{outcome=FAILED}`) and logged at most once a minute. |
| Anything an unauthenticated caller can provoke | `recordAuditThrottled` | At most one event per key per window; the suppressed count rides on the next event. The public endpoints cannot flood the ledger. |

READs never depend on the ledger: an outage degrades evidence for reads, not availability. A queued write refused before dispatch because the ledger was down is retried by the Phase 8 worker (it provably did not run), not failed.

## Redaction (`redaction.ts`)

- identifier columns accept only identifier-shaped strings (`[A-Za-z0-9_.:@/-]{1,200}`) that contain nothing credential-shaped; anything else is stored as null;
- digest columns accept only 64-hex SHA-256; code columns only `[A-Za-z0-9_.:-]`;
- `metadata` keys are an allowlist; unknown keys are dropped; strings are bounded (256) and scrubbed of bearer tokens, JWTs, private keys, Stripe / Razorpay / webhook secrets, AWS / GitHub / Slack tokens, credentials in URLs and 40+ hex runs; NUL bytes are stripped; only `recoveryInput` may be a (flat, identifier-valued) object.

The functions only drop or replace; nothing can turn a value into a secret-bearing one.

## Access

Read: SUPER_ADMIN only (`/admin/agent-governance/ledger`, `requireGovernanceViewer`). Write: none from any route — there is no update or delete function anywhere (asserted by test across `lib/` and `app/`), and the database refuses UPDATE / DELETE / TRUNCATE (`02`). No MCP tool, gateway route or capability touches the ledger.

## Volume and retention

Per agent call roughly: one AUTHORIZATION event, two EXECUTION events for a write (one for a read), plus task / trigger events when asynchronous. Retention is unbounded in this phase; any future retention must be an explicit maintenance procedure that first records a signed checkpoint (head sequence + digest) — the append-only trigger has to be lifted deliberately for it, never by the application.
