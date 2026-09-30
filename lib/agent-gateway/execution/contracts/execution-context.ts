/**
 * lib/agent-gateway/execution/contracts/execution-context.ts
 *
 * Phase 4 — the trusted execution context passed to every adapter.
 *
 * Every field here is either generated server-side (requestId, timestamp)
 * or copied verbatim from the Phase 2 `AgentMachineIdentity` (already
 * resolved from a verified credential — see
 * lib/agent-gateway/identity/request-identity.ts). NOTHING here is ever
 * read from a client-supplied body/header. There is no constructor or
 * builder in this file that accepts untrusted input — see
 * `resolver/build-execution-context.ts` for the ONE place a context is
 * ever assembled, and it only ever reads from `AgentGatewayRequestContext`
 * (Phase 1/2's already-verified request context).
 */
import type { AgentConnectionStatusValue } from "../../shared/types"

export interface AgentExecutionContext {
  /** Correlates this execution with the Phase 1 gateway request. Server-generated. */
  requestId: string
  /** The Phase 2 AgentConnection id. Never client-supplied — copied from the verified machine identity. */
  connectionId: string
  /** Optional external agent identifier, if the connection recorded one. Never client-supplied. */
  agentId?: string
  /** The connection's owner (a real existing User.id). Never client-supplied — this IS the trusted identity boundary for ownership-scoped adapters. */
  ownerId: string
  /** The connection's team, if any. Never client-supplied. */
  teamId?: string | null
  /** Live connection status at authentication time. Informational — the resolver re-verifies liveness itself (see resolver/hard-safety-checks.ts). */
  connectionStatus: AgentConnectionStatusValue

  capabilityId: string
  capabilityVersion: number

  /** Fixed to "development" | "staging" | "production" — copied from the AgentConnection row, never inferred from client input. */
  environment: string

  timestamp: Date

  /** Propagated from the Phase 1 gateway request; adapters MUST check this and abort long-running work promptly. */
  signal: AbortSignal

  /** Present only for capabilities whose Phase 3 metadata declares `requiresIdempotencyKey: true`. */
  idempotencyKey?: string

  /** Safe-to-log tracing metadata only — never a credential, token, or secret. */
  tracing: {
    requestId: string
    connectionId: string
    capabilityId: string
    capabilityVersion: number
  }
}
