/**
 * lib/agent-gateway/approvals/redaction.ts
 *
 * Builds the human-readable summary stored on an approval request and shown
 * to the approver. Material inputs are included so the human can see WHAT
 * they approve; secrets are redacted before anything is persisted.
 */
import type { CapabilityDefinition } from "../capabilities/types"

const SENSITIVE_KEY_PATTERN = /pass(word)?|secret|token|api[-_]?key|private|credential|authorization|cookie|session|otp|pin|cvv|cvc|card|iban|account[-_]?number|signature/i
const MAX_STRING = 200
const MAX_DEPTH = 4
const MAX_KEYS = 40

export const REDACTED = "[REDACTED]"

export function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null
  if (depth >= MAX_DEPTH) return "[TRUNCATED]"
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((v) => redactValue(v, depth + 1))
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue((value as Record<string, unknown>)[key], depth + 1)
    }
    return out
  }
  return "[UNSUPPORTED]"
}

export interface DisplaySummaryInput {
  capability: CapabilityDefinition
  connectionName?: string | null
  agentId: string | null
  ownerId: string
  teamId: string | null
  environment: string
  resourceType: string | null
  resourceId: string | null
  autonomyLevel: string
  input: unknown
}

/** Plain JSON object — safe to persist and render. Contains no credential. */
export function buildDisplaySummary(s: DisplaySummaryInput): Record<string, unknown> {
  return {
    capabilityId: s.capability.id,
    capabilityVersion: s.capability.version,
    action: s.capability.name,
    description: s.capability.description,
    riskTier: s.capability.operationType,
    reversibility: s.capability.rollback.reversibility,
    sideEffects: s.capability.sideEffects.effects,
    environment: s.environment,
    resourceType: s.resourceType,
    resourceId: s.resourceId,
    autonomyLevel: s.autonomyLevel,
    agent: { name: s.connectionName ?? null, agentId: s.agentId },
    owner: { ownerId: s.ownerId, teamId: s.teamId },
    inputs: redactValue(s.input),
    consequence: `Approving allows this agent connection to execute "${s.capability.id}" exactly once, with exactly these inputs, before the approval expires.`,
  }
}
