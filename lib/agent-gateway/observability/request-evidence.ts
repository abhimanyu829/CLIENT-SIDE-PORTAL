/**
 * lib/agent-gateway/observability/request-evidence.ts
 *
 * Phase 11 — the request-level telemetry shared by both agent entry points
 * (transport/http-boundary.ts and mcp/route-handler.ts), so they record the
 * same evidence the same way:
 *
 *   - one trace scope per request (traceId + the pipeline requestId) and an
 *     agent.request span around the whole pipeline;
 *   - authentication evidence. Failures can be provoked by anyone on the
 *     internet, so they are throttled per failure code (at most one ledger
 *     event per code per 10 s, with the suppressed count attached);
 *     successes are throttled per connection (one per minute) — every
 *     later decision and execution event carries the identity anyway;
 *   - agent_requests_total{protocol, outcome}.
 */
import { recordAuditThrottled } from "../audit-ledger/recorder"
import { getCapabilityRegistry } from "../capabilities"
import { recordRegistryFingerprintOnce } from "../capabilities/registry-evidence"
import { countMetric } from "./agent-metrics"
import { deriveTraceId, runWithTraceContext } from "./trace-context"
import { withAgentSpan } from "./tracing"

export type AgentProtocol = "HTTP" | "MCP"

export function withRequestTrace<T>(protocol: AgentProtocol, requestId: string, run: () => Promise<T>): Promise<T> {
  // Phase 12: the capability surface in force is evidence (once per process, only when changed).
  recordRegistryFingerprintOnce(getCapabilityRegistry)
  return runWithTraceContext({ traceId: deriveTraceId(), requestId }, () =>
    withAgentSpan("agent.request", { "agent.protocol": protocol, "agent.request.id": requestId }, run)
  )
}

export function recordAuthenticationFailure(protocol: AgentProtocol, requestId: string, internalCode: string): void {
  countMetric("agent_requests_total", { protocol, outcome: "DENIED" })
  countMetric("agent_security_denial_total", { reason: internalCode })
  recordAuditThrottled(
    {
      action: "authentication.failed",
      outcome: "DENIED",
      actor: { type: "SYSTEM" },
      requestId,
      errorCode: internalCode,
      metadata: { reasonCode: internalCode, source: protocol },
    },
    `auth-failed:${protocol}:${internalCode}`
  )
}

export function recordAuthenticationSuccess(
  protocol: AgentProtocol,
  requestId: string,
  machine: { connectionId: string; agentId?: string; ownerId: string; teamId?: string | null }
): void {
  recordAuditThrottled(
    {
      action: "authentication.succeeded",
      outcome: "SUCCESS",
      actor: { type: "AGENT", id: machine.connectionId },
      requestId,
      connectionId: machine.connectionId,
      agentId: machine.agentId ?? null,
      ownerId: machine.ownerId,
      teamId: machine.teamId ?? null,
      metadata: { source: protocol },
    },
    `auth-ok:${protocol}:${machine.connectionId}`,
    60_000
  )
}

export function countRequest(protocol: AgentProtocol, outcome: "SUCCESS" | "DENIED" | "ERROR"): void {
  countMetric("agent_requests_total", { protocol, outcome })
}
