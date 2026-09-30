/**
 * lib/agent-gateway/approvals/expiration.ts
 *
 * Bounded approval validity. There is no indefinite approval: every request
 * gets an expiry derived from Phase 3 risk metadata and the environment.
 * Expiry is enforced server-side at approve time AND at consume time — a
 * frontend countdown is display only.
 */
import type { CapabilityDefinition } from "../capabilities/types"

const MINUTE = 60_000

/** Base validity by Phase 3 risk tier — higher risk, shorter window. */
const TTL_BY_RISK: Record<string, number> = {
  READ: 30 * MINUTE,
  LOW_RISK_WRITE: 30 * MINUTE,
  HIGH_RISK_MUTATION: 15 * MINUTE,
  CRITICAL: 10 * MINUTE,
}

/** Production operations never get more than 15 minutes. */
const PRODUCTION_CAP = 15 * MINUTE

/** Irreversible operations never get more than 10 minutes. */
const IRREVERSIBLE_CAP = 10 * MINUTE

/** The out-of-band step-up code is valid for at most 5 minutes. */
export const STEP_UP_TTL_MS = 5 * MINUTE

export function approvalTtlMs(capability: CapabilityDefinition, environment: string): number {
  let ttl = TTL_BY_RISK[capability.operationType] ?? 10 * MINUTE
  if (environment === "production") ttl = Math.min(ttl, PRODUCTION_CAP)
  if (capability.rollback.reversibility === "IRREVERSIBLE") ttl = Math.min(ttl, IRREVERSIBLE_CAP)
  return ttl
}

/** True when `now` is at or past `expiresAt` — the boundary instant counts as expired. */
export function isExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime()
}
