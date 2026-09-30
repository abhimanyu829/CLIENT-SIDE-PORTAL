/**
 * lib/agent-gateway/auth/error-mapping.ts
 *
 * Collapses the internal, granular authentication-failure taxonomy
 * (InternalAuthFailureCode) down to a small external set before any
 * response reaches the caller (Phase 2 spec §39).
 *
 * Rationale: if "invalid credential" and "credential belongs to a
 * suspended connection" returned visibly different errors, an attacker
 * could enumerate which captured/guessed tokens correspond to real,
 * suspended connections vs. tokens that don't exist at all. Both must
 * look identical from the outside. The granular code is still used
 * internally for logging/audit (see observability/audit-hook.ts) — this
 * mapping only affects what crosses the external boundary.
 */
import type { InternalAuthFailureCode } from "../shared/types"
import type { GatewayErrorCode } from "../shared/errors"

/**
 * External-facing bucket. Only three outcomes are ever distinguishable
 * from outside the gateway: "you didn't authenticate", "that credential
 * doesn't work (for any reason)", or "rate limited" (handled elsewhere).
 */
export function toExternalAuthErrorCode(internal: InternalAuthFailureCode): GatewayErrorCode {
  if (internal === "AUTH_REQUIRED") return "AUTH_REQUIRED"
  // Every other reason — wrong token, unknown connection, pending,
  // suspended, revoked, expired, environment mismatch — maps to the same
  // external code. This is intentional, not a shortcut.
  return "AUTH_INVALID"
}
