/**
 * lib/agent-gateway/approvals/binding.ts
 *
 * Binds an approval to the EXACT operation it authorizes. The binding digest
 * covers every value whose change must invalidate an approval: principal,
 * capability + version, resource, environment, the canonical input, and the
 * authorization/autonomy policy versions in force.
 *
 * approve(operation A) can therefore never authorize operation B — B has a
 * different digest, and the gate only consumes an approval whose stored
 * digest equals the digest recomputed from the live request.
 */
import { sha256Hex } from "../shared/crypto"
import { canonicalJson } from "./canonical-json"

export interface OperationBinding {
  connectionId: string
  agentId: string | null
  ownerId: string
  teamId: string | null
  capabilityId: string
  capabilityVersion: number
  resourceType: string | null
  resourceId: string | null
  environment: string
  inputDigest: string
  /** "<policyVersionId>@v<n>" of the Phase 6 policy that matched, or "none". */
  authorizationPolicyRef: string
  /** Autonomy policy version in force, or null for the default posture. */
  autonomyPolicyVersion: number | null
}

/** Binding format version — bump if the digest composition ever changes. */
const BINDING_VERSION = "abhibhi.approval-binding.v1"

export function computeInputDigest(input: unknown): string {
  return sha256Hex(`abhibhi.approval-input.v1\n${canonicalJson(input)}`)
}

export function computeBindingDigest(binding: OperationBinding): string {
  return sha256Hex(`${BINDING_VERSION}\n${canonicalJson(binding)}`)
}

/** Key for the unique `activeBindingKey` column — one live approval per connection+operation. */
export function activeBindingKey(connectionId: string, bindingDigest: string): string {
  return `${connectionId}:${bindingDigest}`
}
