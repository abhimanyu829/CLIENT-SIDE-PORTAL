/**
 * lib/agent-gateway/audit-ledger/digest.ts
 *
 * Phase 11 — the integrity model of the ledger.
 *
 *   eventDigest = SHA-256( "abhibhi.audit.v1" \n previousEventDigest \n canonicalJson(body) )
 *
 * `body` is EVERY stored field except the row's database id, its
 * recordedAt timestamp (database clock) and eventDigest itself — including
 * the sequence number, the eventId and the schema version. Canonical JSON
 * is the Phase 7 RFC 8785 serializer (approvals/canonical-json.ts), reused
 * rather than re-implemented.
 *
 * Consequences:
 *   - editing any field of an event changes its digest (tamper evident);
 *   - an event's digest covers its predecessor's digest, so removing,
 *     reordering or substituting events breaks every later link;
 *   - a replayed (copied) event collides on eventId / sequence / digest.
 * The chain's first event links to GENESIS_DIGEST.
 */
import { createHash } from "crypto"
import { canonicalJson } from "../approvals/canonical-json"
import type { AuditEventRow } from "./types"

export const AUDIT_DIGEST_DOMAIN = "abhibhi.audit.v1"
export const GENESIS_DIGEST = "0".repeat(64)

const sha256Hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

export type DigestableEvent = Omit<AuditEventRow, "id" | "recordedAt" | "eventDigest">

/** The exact field set the digest covers, in a stable shape (absent optional fields are null). */
export function canonicalEventBody(event: DigestableEvent): Record<string, unknown> {
  return {
    sequence: event.sequence,
    eventId: event.eventId,
    schemaVersion: event.schemaVersion,
    category: event.category,
    action: event.action,
    outcome: event.outcome,
    occurredAt: new Date(event.occurredAt).toISOString(),
    requestId: event.requestId ?? null,
    traceId: event.traceId ?? null,
    actorType: event.actorType,
    actorId: event.actorId ?? null,
    connectionId: event.connectionId ?? null,
    agentId: event.agentId ?? null,
    ownerId: event.ownerId ?? null,
    teamId: event.teamId ?? null,
    capabilityId: event.capabilityId ?? null,
    capabilityVersion: event.capabilityVersion ?? null,
    riskTier: event.riskTier ?? null,
    resourceType: event.resourceType ?? null,
    resourceRef: event.resourceRef ?? null,
    environment: event.environment ?? null,
    authorizationDecision: event.authorizationDecision ?? null,
    authorizationPolicyRef: event.authorizationPolicyRef ?? null,
    autonomyLevel: event.autonomyLevel ?? null,
    autonomyPolicyVersion: event.autonomyPolicyVersion ?? null,
    approvalRef: event.approvalRef ?? null,
    taskRef: event.taskRef ?? null,
    triggerRef: event.triggerRef ?? null,
    adapterId: event.adapterId ?? null,
    executionStatus: event.executionStatus ?? null,
    resultCode: event.resultCode ?? null,
    errorCode: event.errorCode ?? null,
    inputDigest: event.inputDigest ?? null,
    outputDigest: event.outputDigest ?? null,
    metadata: event.metadata ?? null,
    previousEventDigest: event.previousEventDigest,
  }
}

export function computeEventDigest(event: DigestableEvent): string {
  return sha256Hex(`${AUDIT_DIGEST_DOMAIN}\n${event.previousEventDigest}\n${canonicalJson(canonicalEventBody(event))}`)
}

/** Digest of a capability result for the ledger (the result itself is never stored). Null when it cannot be canonicalized. */
export function computeOutputDigest(output: unknown): string | null {
  try {
    return sha256Hex(`abhibhi.audit-output.v1\n${canonicalJson(output)}`)
  } catch {
    return null
  }
}
