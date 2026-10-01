/**
 * lib/agent-gateway/recovery/spec.ts
 *
 * Phase 11 — capability-aware recovery classification.
 *
 * Rollback never means "reverse every database change". Each capability
 * declares, in its Phase 3 definition, what recovery is possible:
 *
 *   REVERSIBLE            an explicit reverse capability restores the state
 *   COMPENSATABLE         an explicit compensation capability offsets the effect
 *   PARTIALLY_REVERSIBLE  supported state is restored; residual effects documented
 *   IRREVERSIBLE          nothing is faked: a manual-recovery recommendation is recorded
 *
 * The mapping is DATA, never code: the recovery capability is a registered
 * capability id + version, and its input is built from the original
 * execution's recorded identifiers through a declarative field map
 * ("input.<field>" / "output.<field>", top-level primitives only). There is
 * no `rollback(arbitraryOperation)`; a write without an explicit mapping is
 * treated as manual recovery.
 */
import type { CapabilityDefinition } from "../capabilities/types"

export type RecoveryClass = "REVERSIBLE" | "COMPENSATABLE" | "PARTIALLY_REVERSIBLE" | "IRREVERSIBLE"
export const RECOVERY_CLASSES: readonly RecoveryClass[] = ["REVERSIBLE", "COMPENSATABLE", "PARTIALLY_REVERSIBLE", "IRREVERSIBLE"]

export interface RecoverySpec {
  class: RecoveryClass
  /** The explicit reverse / compensation capability (required unless IRREVERSIBLE). */
  capabilityId?: string
  capabilityVersion?: number
  /** Recovery-input field -> "input.<field>" | "output.<field>" of the original execution. */
  inputMapping?: Record<string, string>
  /** What remains after recovery (PARTIALLY_REVERSIBLE / COMPENSATABLE). */
  residualEffects?: string
  /** True when a human must act even if a recovery capability exists. */
  manualRecoveryRequired: boolean
  /** Shown to the administrator when recovery is manual. */
  recommendation: string
}

const SOURCE = /^(input|output)\.[A-Za-z][A-Za-z0-9_]{0,63}$/
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,63}$/
const CAPABILITY_ID = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/

export class RecoverySpecError extends Error {
  constructor(capabilityId: string, message: string) {
    super(`Capability "${capabilityId}" has an invalid recovery specification: ${message}`)
    this.name = "RecoverySpecError"
  }
}

/** Registration-time validation (called from the Phase 3 registry). */
export function assertValidRecoverySpec(def: CapabilityDefinition): void {
  const spec = def.rollback.recovery
  if (!spec) return
  if (!RECOVERY_CLASSES.includes(spec.class)) throw new RecoverySpecError(def.id, `unknown class "${String(spec.class)}"`)
  if (!spec.recommendation || spec.recommendation.length > 500) throw new RecoverySpecError(def.id, "a recommendation (<= 500 chars) is required")
  if (def.rollback.reversibility === "IRREVERSIBLE" && spec.class !== "IRREVERSIBLE") {
    throw new RecoverySpecError(def.id, "an IRREVERSIBLE capability cannot declare an automatic recovery")
  }
  if (spec.class === "IRREVERSIBLE") {
    if (spec.capabilityId || spec.inputMapping) throw new RecoverySpecError(def.id, "IRREVERSIBLE recovery cannot reference a recovery capability")
    return
  }
  if (!spec.capabilityId || !CAPABILITY_ID.test(spec.capabilityId)) throw new RecoverySpecError(def.id, "a recovery capability id is required")
  if (spec.capabilityId === def.id) throw new RecoverySpecError(def.id, "a capability cannot recover itself")
  if (!Number.isInteger(spec.capabilityVersion) || (spec.capabilityVersion ?? 0) < 1) throw new RecoverySpecError(def.id, "a recovery capability version is required")
  const mapping = spec.inputMapping ?? {}
  if (Object.keys(mapping).length === 0 || Object.keys(mapping).length > 10) throw new RecoverySpecError(def.id, "1-10 input mappings are required")
  for (const [field, source] of Object.entries(mapping)) {
    if (!FIELD.test(field) || !SOURCE.test(source)) throw new RecoverySpecError(def.id, `invalid mapping "${field}" -> "${source}"`)
  }
}

/** The effective recovery for a capability. Writes without an explicit spec are manual. */
export function resolveRecoverySpec(def: CapabilityDefinition): RecoverySpec | null {
  if (def.operationType === "READ") return null
  if (def.rollback.recovery) return def.rollback.recovery
  return {
    class: "IRREVERSIBLE",
    manualRecoveryRequired: true,
    recommendation: def.rollback.mechanism || "No automatic recovery is defined for this capability. Review the affected resource manually.",
  }
}

/**
 * Builds the identifiers the recovery capability will need, from the
 * ORIGINAL validated input and the adapter's validated output. Only
 * top-level string / number / boolean values; null when a mapped field is
 * missing (recovery is then manual).
 */
export function captureRecoveryInput(spec: RecoverySpec | null, input: unknown, output: unknown): Record<string, string | number | boolean> | null {
  if (!spec || spec.class === "IRREVERSIBLE" || !spec.inputMapping) return null
  const sources: Record<string, unknown> = { input, output }
  const captured: Record<string, string | number | boolean> = {}
  for (const [field, source] of Object.entries(spec.inputMapping)) {
    const [root, key] = source.split(".") as [string, string]
    const container = sources[root]
    if (!container || typeof container !== "object") return null
    const value = (container as Record<string, unknown>)[key]
    if (typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) captured[field] = value
    else return null
  }
  return captured
}
