/**
 * lib/agent-gateway/tasks/ids.ts
 *
 * Task identity. The task reference, the DB id, the request id, the
 * approval id and the connection id are distinct concepts and are never
 * reused for one another.
 */
import { randomBytes } from "crypto"
import { sha256Hex } from "../shared/crypto"
import { canonicalJson } from "../approvals/canonical-json"

const TASK_REF_PATTERN = /^atk_[0-9a-f]{32}$/
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/

/** 128 bits of CSPRNG output — unguessable, display-safe, never the DB id. */
export function generateTaskRef(): string {
  return `atk_${randomBytes(16).toString("hex")}`
}

export function isValidTaskRef(ref: unknown): ref is string {
  return typeof ref === "string" && TASK_REF_PATTERN.test(ref)
}

export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && IDEMPOTENCY_KEY_PATTERN.test(key)
}

/** Idempotency keys are always scoped to the calling connection. */
export function idempotencyScopeFor(connectionId: string, idempotencyKey: string): string {
  return `${connectionId}:${idempotencyKey}`
}

/**
 * Key prefix reserved for server-originated (Phase 9 trigger) submissions.
 * Agents cannot use it, so a trigger run's task identity can never be
 * pre-claimed or collided with through the agent-facing tools.
 */
export const TRIGGER_IDEMPOTENCY_PREFIX = "trigger."

/** Deterministic task idempotency key of one trigger run (re-deliveries reuse it). */
export function triggerIdempotencyKey(runRef: string): string {
  return `${TRIGGER_IDEMPOTENCY_PREFIX}${runRef.replace(/^trr_/, "")}`
}

export interface OperationKeyParts {
  connectionId: string
  capabilityId: string
  capabilityVersion: number
  resourceType: string | null
  resourceId: string | null
  inputDigest: string
}

/** Stable identity of "the same operation" for key-less duplicate detection. */
export function operationKeyFor(parts: OperationKeyParts): string {
  return sha256Hex(`abhibhi.agent-task-operation.v1\n${canonicalJson(parts)}`)
}

/**
 * Deterministic BullMQ job id for one attempt: enqueueing the same attempt
 * twice yields one job. BullMQ custom ids must not contain ":".
 */
export function jobIdFor(taskId: string, attempt: number): string {
  return `${taskId}-a${attempt}`
}
