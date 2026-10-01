# Phase 12 — 02 Trust boundaries

Source of truth: `lib/agent-gateway/security/trust-boundaries.ts`. This table mirrors it; `p12-threat-model.test.ts` checks that each boundary's enforcing modules and proving tests exist and that this document and `01-threat-model.md` cover every id.

| Id | From → To | Data trust | Key controls | Enforced by | Proven by |
|---|---|---|---|---|---|
| TB1 | AI agent → gateway (MCP / HTTP) | authenticated, untrusted | authentication + replay protection, rate / size limits, host / origin checks, executable-only tools, gate on every call, input hygiene + strict schemas | `auth/*`, `limits/rate-limiter.ts`, `security/request-validation.ts`, `mcp/transport-security.ts`, `mcp/tool-projection.ts`, `execution-gate/gate.ts`, `security/input-hygiene.ts` | `p12-tool-security`, `p12-injection`, `authz-security` |
| TB2 | third-party content → agent (tool results) | untrusted | output schema, fail-closed secret redaction, 256 KiB cap, content notice + trust annotation + injection signals | `execution/resolver/adapter-resolver.ts`, `security/content-guard.ts`, `security/injection-detector.ts`, `mcp/content-result.ts` | `p12-injection`, `p12-exfiltration` |
| TB3 | webhook sender → trigger runtime | untrusted | HMAC, single-use nonce, rate limit, trigger (not body) fixes capability and input | `triggers/webhook-handler.ts`, `triggers/secrets.ts`, `triggers/runtime.ts` | `p9-webhook`, `p10-cross-phase` |
| TB4 | human admin → governance | trusted human | SUPER_ADMIN + live session, agent credentials refused, JSON-only bodies, optimistic concurrency, AuditLog + ledger | `governance/access.ts`, `governance/http.ts`, `approvals/human-session.ts` | `p10-governance-access`, `p11-governance` |
| TB5 | agent-proposed operation → human approver | untrusted | binding digest, SMS step-up, display redaction of keys and secret-shaped values, input hygiene before approval creation, injection warning | `approvals/decision-service.ts`, `approvals/redaction.ts`, `security/input-hygiene.ts` | `p12-injection`, `p7-approval-primitives` |
| TB6 | gateway → business services (adapters) | trusted system | identity only from the verified context, owner scoping, explicit selects, published products only | `execution/resolver/build-execution-context.ts`, `execution/adapters/*` | `p12-isolation`, `execution-security` |
| TB7 | gateway → datastores | trusted system | Prisma parameterised queries only, hashed / encrypted secrets, append-only ledger, pinned capability surface | `shared/crypto.ts`, `audit-ledger/ledger.ts` | `p12-secrets`, `p11-ledger`, `p12-supply-chain` |
| TB8 | gateway → external network | untrusted | no agent-reachable outbound request; outbound guard (allowlist, connect-time public-address check, no redirects) | `routing/backend-router.ts`, `security/outbound-guard.ts` | `p12-ssrf`, `p12-supply-chain` |
| TB9 | queue → task worker | authenticated, untrusted | payload / input digests, live re-authorization before every attempt, attempt-scoped job ids | `tasks/guard.ts`, `tasks/worker.ts` | `p8-task-worker` |
| TB10 | operator config / secrets → runtime, logs, telemetry | trusted system | config modules are the only env readers, pino redaction, allowlisted span attributes and metric labels, ledger scrubbing | `config.ts`, `observability/request-log.ts`, `observability/tracing.ts`, `audit-ledger/redaction.ts` | `p12-secrets` |

## Rules that follow from the boundaries

1. Nothing an agent sends is trusted for identity, ownership or capability selection (TB1, TB3, TB6).
2. Nothing a third party wrote is presented to an agent as an instruction (TB2).
3. Nothing an agent proposed is shown to a human without redaction and warnings (TB5).
4. Every secret leaves the process only in hashed, encrypted or redacted form (TB7, TB10).
5. The gateway initiates no outbound request reachable by an agent (TB8).
