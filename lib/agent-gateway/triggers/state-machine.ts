/**
 * lib/agent-gateway/triggers/state-machine.ts
 *
 *   DRAFT    -> ACTIVE | DISABLED | REVOKED
 *   ACTIVE   -> PAUSED | DISABLED | EXPIRED | REVOKED
 *   PAUSED   -> ACTIVE | DISABLED | EXPIRED | REVOKED
 *   DISABLED -> ACTIVE | REVOKED
 *   EXPIRED, REVOKED: terminal
 *
 * Only ACTIVE triggers ever fire. Every transition is one conditional update
 * (status + version for human actions), so concurrent edits can't interleave.
 */
import type { TriggerAction, TriggerStatus } from "./types"

const LEGAL: Record<TriggerStatus, readonly TriggerStatus[]> = {
  DRAFT: ["ACTIVE", "DISABLED", "REVOKED"],
  ACTIVE: ["PAUSED", "DISABLED", "EXPIRED", "REVOKED"],
  PAUSED: ["ACTIVE", "DISABLED", "EXPIRED", "REVOKED"],
  DISABLED: ["ACTIVE", "REVOKED"],
  EXPIRED: [],
  REVOKED: [],
}

export function isLegalTriggerTransition(from: TriggerStatus, to: TriggerStatus): boolean {
  return LEGAL[from]?.includes(to) ?? false
}

export function isTerminalTriggerStatus(status: TriggerStatus): boolean {
  return LEGAL[status].length === 0
}

/** Human actions -> (allowed source states, target state). */
export const TRIGGER_ACTIONS: Record<TriggerAction, { from: readonly TriggerStatus[]; to: TriggerStatus }> = {
  activate: { from: ["DRAFT", "DISABLED"], to: "ACTIVE" },
  resume: { from: ["PAUSED"], to: "ACTIVE" },
  pause: { from: ["ACTIVE"], to: "PAUSED" },
  disable: { from: ["DRAFT", "ACTIVE", "PAUSED"], to: "DISABLED" },
  revoke: { from: ["DRAFT", "ACTIVE", "PAUSED", "DISABLED"], to: "REVOKED" },
}

/** Configuration may only change while the trigger cannot fire. */
export const EDITABLE_TRIGGER_STATUSES: readonly TriggerStatus[] = ["DRAFT", "PAUSED", "DISABLED"]
