/**
 * lib/agent-gateway/execution/resolver/build-execution-context.ts
 *
 * The ONE place an `AgentExecutionContext` is ever assembled. Every field
 * is copied from the already-verified `AgentGatewayRequestContext.machine`
 * (Phase 2) or generated server-side — nothing here reads from a request
 * body, a query parameter, or any client-supplied header.
 */
import type { AgentGatewayRequestContext } from "../../shared/types"
import type { AgentExecutionContext } from "../contracts/execution-context"
import { ExecutionError } from "../contracts/execution-error"

export function buildExecutionContext(
  gatewayContext: AgentGatewayRequestContext,
  capabilityId: string,
  capabilityVersion: number,
  environment: string,
  idempotencyKey?: string
): AgentExecutionContext {
  const machine = gatewayContext.machine
  if (!machine) {
    // Structural guard: this function must never be called for an
    // unauthenticated request — the resolver's caller is responsible for
    // rejecting those before execution is ever attempted. Fail closed
    // rather than fabricate a fallback identity.
    throw new ExecutionError("FORBIDDEN", "No verified machine identity is present on this request.")
  }

  return {
    requestId: gatewayContext.requestId,
    connectionId: machine.connectionId,
    agentId: machine.agentId,
    ownerId: machine.ownerId,
    teamId: machine.teamId,
    connectionStatus: machine.connectionStatus,
    capabilityId,
    capabilityVersion,
    environment,
    timestamp: new Date(),
    signal: gatewayContext.signal,
    idempotencyKey,
    tracing: {
      requestId: gatewayContext.requestId,
      connectionId: machine.connectionId,
      capabilityId,
      capabilityVersion,
    },
  }
}
