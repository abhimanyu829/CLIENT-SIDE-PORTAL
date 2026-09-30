/**
 * lib/agent-gateway/observability/audit-hook.ts
 *
 * GatewayAuditHook implementation for Phase 1. Records into the existing
 * structured logger only — Phase 0 confirmed AgentAuditLog (the DB-backed,
 * append-only audit ledger) is a Phase 3+ concern (it's a business-domain
 * concept tied to capabilities/policy decisions, which don't exist yet).
 * This log-based hook satisfies the GatewayAuditHook interface today and
 * can be swapped for a DB-backed implementation later without any caller
 * changing — the interface is the extension point, not this file.
 */
import type { GatewayAuditEvent, GatewayAuditHook } from "../shared/types"
import { gatewayLogger } from "./request-log"

export class LoggingAuditHook implements GatewayAuditHook {
  async record(event: GatewayAuditEvent): Promise<void> {
    gatewayLogger.info(
      {
        requestId: event.requestId,
        timestamp: event.timestamp.toISOString(),
        component: event.component,
        outcome: event.outcome,
        connectionId: event.connectionId,
        agentId: event.agentId,
        route: event.route,
        statusCode: event.statusCode,
        errorCode: event.errorCode,
        latencyMs: event.latencyMs,
      },
      "agent_gateway_audit_event"
    )
  }
}

let auditHookSingleton: GatewayAuditHook = new LoggingAuditHook()

export function getAuditHook(): GatewayAuditHook {
  return auditHookSingleton
}

/** Test-only: inject a fake audit hook to assert on recorded events. */
export function __setAuditHookForTests(hook: GatewayAuditHook): void {
  auditHookSingleton = hook
}
