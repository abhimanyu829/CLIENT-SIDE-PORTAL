/**
 * lib/agent-gateway/security/trust-boundaries.ts
 *
 * Phase 12 — the trust boundaries of the agent platform, as code, so the
 * threat model cannot silently drift from the implementation: a test
 * (p12-threat-model) checks that every enforcing module listed here exists
 * and that every boundary names at least one control and one test suite.
 * Documented in docs/agent-gateway/phase-12/02-trust-boundaries.md.
 */

export type TrustLevel = "UNTRUSTED" | "AUTHENTICATED_UNTRUSTED" | "TRUSTED_HUMAN" | "TRUSTED_SYSTEM"

export interface TrustBoundary {
  id: string
  from: string
  to: string
  /** How much the data crossing the boundary is trusted by the receiving side. */
  dataTrust: TrustLevel
  threats: string[]
  controls: string[]
  /** Repository paths of the modules that enforce the controls. */
  enforcedBy: string[]
  /** Test files that prove the controls. */
  provenBy: string[]
}

export const TRUST_BOUNDARIES: readonly TrustBoundary[] = [
  {
    id: "TB1",
    from: "AI agent (possibly prompt-injected)",
    to: "Agent gateway (MCP / HTTP)",
    dataTrust: "AUTHENTICATED_UNTRUSTED",
    threats: ["credential theft / replay", "privilege escalation", "tool misuse", "hostile input", "resource exhaustion"],
    controls: [
      "bearer / HMAC-signed authentication, nonce replay protection",
      "per-connection rate limits, body size limits, host / origin checks",
      "executable-only tool surface",
      "Phase 6 authorization, Phase 7 autonomy and human approval on every call",
      "input hygiene + strict schemas before the gate",
    ],
    enforcedBy: [
      "lib/agent-gateway/auth/composite-authenticator.ts",
      "lib/agent-gateway/auth/replay-protection.ts",
      "lib/agent-gateway/limits/rate-limiter.ts",
      "lib/agent-gateway/security/request-validation.ts",
      "lib/agent-gateway/mcp/transport-security.ts",
      "lib/agent-gateway/mcp/tool-projection.ts",
      "lib/agent-gateway/execution-gate/gate.ts",
      "lib/agent-gateway/security/input-hygiene.ts",
    ],
    provenBy: ["lib/agent-gateway/tests/p12-tool-security.test.ts", "lib/agent-gateway/tests/p12-injection.test.ts", "lib/agent-gateway/tests/authz-security.test.ts"],
  },
  {
    id: "TB2",
    from: "Third-party content (vendor product text, customer ticket text)",
    to: "AI agent (through tool results)",
    dataTrust: "UNTRUSTED",
    threats: ["indirect prompt injection", "secret leakage through stored data", "bulk extraction"],
    controls: ["output schema (allowlisted fields)", "secret redaction (fail closed)", "result size bound", "injection signals + content notice + trust annotation"],
    enforcedBy: [
      "lib/agent-gateway/execution/resolver/adapter-resolver.ts",
      "lib/agent-gateway/security/content-guard.ts",
      "lib/agent-gateway/security/injection-detector.ts",
      "lib/agent-gateway/mcp/content-result.ts",
    ],
    provenBy: ["lib/agent-gateway/tests/p12-injection.test.ts", "lib/agent-gateway/tests/p12-exfiltration.test.ts"],
  },
  {
    id: "TB3",
    from: "Webhook sender (external partner)",
    to: "Webhook endpoint / trigger runtime",
    dataTrust: "UNTRUSTED",
    threats: ["forged delivery", "replay", "capability selection by payload", "flooding"],
    controls: ["HMAC over method, path, timestamp, nonce, event id and body", "single-use nonce (fails closed)", "rate limit", "the trigger, never the body, fixes capability and input"],
    enforcedBy: ["lib/agent-gateway/triggers/webhook-handler.ts", "lib/agent-gateway/triggers/secrets.ts", "lib/agent-gateway/triggers/runtime.ts"],
    provenBy: ["lib/agent-gateway/tests/p9-webhook.test.ts", "lib/agent-gateway/tests/p10-cross-phase.test.ts"],
  },
  {
    id: "TB4",
    from: "Human administrator",
    to: "Agent governance (pages and routes)",
    dataTrust: "TRUSTED_HUMAN",
    threats: ["sub-admin escalation", "agent credential used as admin", "CSRF", "lost update"],
    controls: ["SUPER_ADMIN + live session", "agent credentials refused", "JSON-only bodies", "optimistic concurrency", "AuditLog + ledger"],
    enforcedBy: ["lib/agent-gateway/governance/access.ts", "lib/agent-gateway/governance/http.ts", "lib/agent-gateway/approvals/human-session.ts"],
    provenBy: ["lib/agent-gateway/tests/p10-governance-access.test.ts", "lib/agent-gateway/tests/p11-governance.test.ts"],
  },
  {
    id: "TB5",
    from: "Agent-proposed operation",
    to: "Human approver",
    dataTrust: "UNTRUSTED",
    threats: ["social engineering of the approver through input text", "hidden / bidirectional characters", "approving a different operation than shown"],
    controls: ["binding digest confirmation", "SMS step-up", "display summary redaction (keys and secret-shaped values)", "input hygiene before approval creation", "injection warning on the approval page"],
    enforcedBy: ["lib/agent-gateway/approvals/decision-service.ts", "lib/agent-gateway/approvals/redaction.ts", "lib/agent-gateway/security/input-hygiene.ts"],
    provenBy: ["lib/agent-gateway/tests/p12-injection.test.ts", "lib/agent-gateway/tests/p7-approval-primitives.test.ts"],
  },
  {
    id: "TB6",
    from: "Agent gateway",
    to: "Existing business services (adapters)",
    dataTrust: "TRUSTED_SYSTEM",
    threats: ["confused deputy", "cross-tenant access", "over-broad reads"],
    controls: ["identity only from the verified context", "owner scoping in every adapter", "explicit selects", "published products only"],
    enforcedBy: ["lib/agent-gateway/execution/resolver/build-execution-context.ts", "lib/agent-gateway/execution/adapters/index.ts"],
    provenBy: ["lib/agent-gateway/tests/p12-isolation.test.ts", "lib/agent-gateway/tests/execution-security.test.ts"],
  },
  {
    id: "TB7",
    from: "Agent gateway",
    to: "Datastores (Postgres, Redis)",
    dataTrust: "TRUSTED_SYSTEM",
    threats: ["injection", "secret disclosure at rest", "evidence tampering"],
    controls: ["Prisma parameterised queries only", "hashed tokens, encrypted signing / webhook secrets", "append-only hash-chained ledger"],
    enforcedBy: ["lib/agent-gateway/shared/crypto.ts", "lib/agent-gateway/audit-ledger/ledger.ts"],
    provenBy: ["lib/agent-gateway/tests/p12-secrets.test.ts", "lib/agent-gateway/tests/p11-ledger.test.ts", "lib/agent-gateway/tests/p12-supply-chain.test.ts"],
  },
  {
    id: "TB8",
    from: "Agent gateway",
    to: "External network",
    dataTrust: "UNTRUSTED",
    threats: ["SSRF to internal services / cloud metadata", "DNS rebinding", "data exfiltration"],
    controls: ["no agent-reachable outbound request exists (static scan)", "outbound guard: allowlist, public-address check at connect time, no redirects"],
    enforcedBy: ["lib/agent-gateway/routing/backend-router.ts", "lib/agent-gateway/security/outbound-guard.ts"],
    provenBy: ["lib/agent-gateway/tests/p12-ssrf.test.ts", "lib/agent-gateway/tests/p12-supply-chain.test.ts"],
  },
  {
    id: "TB9",
    from: "Queue (BullMQ job)",
    to: "Task worker",
    dataTrust: "AUTHENTICATED_UNTRUSTED",
    threats: ["tampered job payload", "stale authorization", "replayed job"],
    controls: ["payload / input integrity digests", "live re-authorization before every attempt", "attempt-scoped job ids"],
    enforcedBy: ["lib/agent-gateway/tasks/guard.ts", "lib/agent-gateway/tasks/worker.ts"],
    provenBy: ["lib/agent-gateway/tests/p8-task-worker.test.ts"],
  },
  {
    id: "TB10",
    from: "Operator configuration and secrets",
    to: "Gateway runtime, logs, telemetry",
    dataTrust: "TRUSTED_SYSTEM",
    threats: ["secret in logs / spans / metrics / ledger / tool output"],
    controls: ["config modules are the only env readers", "pino redaction", "allowlisted span attributes and metric labels", "ledger metadata allowlist + scrubbing"],
    enforcedBy: ["lib/agent-gateway/config.ts", "lib/agent-gateway/observability/request-log.ts", "lib/agent-gateway/observability/tracing.ts", "lib/agent-gateway/audit-ledger/redaction.ts"],
    provenBy: ["lib/agent-gateway/tests/p12-secrets.test.ts"],
  },
]
