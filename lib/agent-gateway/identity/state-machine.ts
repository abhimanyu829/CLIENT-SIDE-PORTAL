/**
 * lib/agent-gateway/identity/state-machine.ts
 *
 * Server-enforced AgentConnection state transitions (Phase 2 spec §29/§30).
 * Nothing outside this module may decide whether a transition is legal —
 * the connection-service calls `assertLegalTransition` before every status
 * write, so a client can never set `status` directly regardless of what
 * value it sends.
 */
import type { AgentConnectionStatus } from "@prisma/client"
import { GatewayError } from "../shared/errors"

const LEGAL_TRANSITIONS: Record<AgentConnectionStatus, AgentConnectionStatus[]> = {
  PENDING: ["ACTIVE", "REVOKED"],
  ACTIVE: ["SUSPENDED", "REVOKED", "EXPIRED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
  EXPIRED: ["REVOKED"],
  REVOKED: [], // terminal
}

export function isLegalTransition(from: AgentConnectionStatus, to: AgentConnectionStatus): boolean {
  if (from === to) return true // idempotent no-op transitions are handled by callers, not here
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false
}

/** Throws ILLEGAL_STATE_TRANSITION if `to` is not reachable from `from`. */
export function assertLegalTransition(from: AgentConnectionStatus, to: AgentConnectionStatus): void {
  if (from === to) return
  if (!isLegalTransition(from, to)) {
    throw new GatewayError(
      "ILLEGAL_STATE_TRANSITION",
      `Cannot transition connection from ${from} to ${to}.`
    )
  }
}
