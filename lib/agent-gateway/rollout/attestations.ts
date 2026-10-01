/**
 * lib/agent-gateway/rollout/attestations.ts
 *
 * Phase 15 — release attestations are ledger events
 * (`release.attestation_recorded`), not a table: append-only, hash-chained
 * and tamper-evident by construction (Phase 11). An attestation records
 * that a named operator confirmed the release checklist for one capability
 * in one environment, together with the health gate the system measured at
 * that moment. Advancing a rollout to GENERAL in production requires a
 * passed attestation younger than ATTESTATION_MAX_AGE_MS.
 */
import { db } from "@/lib/db"
import { recordAuditStrict } from "../audit-ledger/recorder"
import type { AuditEventRow } from "../audit-ledger/types"
import { evaluateHealth, type HealthReport } from "./health-gates"

export const ATTESTATION_CHECKS = ["TESTS_PASSED", "SECURITY_REVIEWED", "ROLLBACK_PLAN_READY", "MONITORING_READY", "ON_CALL_ASSIGNED"] as const
export type AttestationCheck = (typeof ATTESTATION_CHECKS)[number]
export const ATTESTATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface AttestationView {
  eventId: string
  capabilityId: string
  environment: string
  passed: boolean
  failedChecks: string[]
  healthy: boolean
  recordedBy: string | null
  recordedAt: string
}

export function toAttestationView(row: AuditEventRow): AttestationView {
  const meta = (row.metadata ?? {}) as Record<string, unknown>
  return {
    eventId: row.eventId,
    capabilityId: row.capabilityId ?? "",
    environment: row.environment ?? "",
    passed: meta.passed === true,
    failedChecks: Array.isArray(meta.failedChecks) ? (meta.failedChecks as string[]) : [],
    healthy: meta.healthy === true,
    recordedBy: row.actorId,
    recordedAt: new Date(row.occurredAt).toISOString(),
  }
}

/**
 * Records one attestation. `confirmed` lists the checks the operator
 * confirmed; every check not confirmed is a failed check. The system adds
 * its own health gate: an UNHEALTHY or UNAVAILABLE health report fails the
 * attestation regardless of what was confirmed.
 */
export async function recordReleaseAttestation(
  input: { capabilityId: string; environment: string; confirmed: readonly string[]; reason: string; actorId: string },
  now: Date
): Promise<{ view: AttestationView; health: HealthReport }> {
  const health = await evaluateHealth({ capabilityId: input.capabilityId, environment: input.environment }, now)
  const failedChecks: string[] = ATTESTATION_CHECKS.filter((c) => !input.confirmed.includes(c))
  if (health.verdict === "UNHEALTHY" || health.verdict === "UNAVAILABLE") failedChecks.push(`HEALTH_${health.verdict}`)
  const healthy = health.verdict === "HEALTHY" || health.verdict === "INSUFFICIENT_DATA"
  const passed = failedChecks.length === 0
  const row = await recordAuditStrict({
    action: "release.attestation_recorded",
    outcome: passed ? "SUCCESS" : "INFO",
    actor: { type: "HUMAN", id: input.actorId },
    capabilityId: input.capabilityId,
    environment: input.environment,
    resourceType: "ReleaseAttestation",
    metadata: { passed, failedChecks, healthy, reason: input.reason, kind: health.verdict },
  })
  return { view: toAttestationView(row), health }
}

export async function findLatestAttestation(capabilityId: string, environment: string): Promise<AuditEventRow | null> {
  return ((await db.agentAuditEvent.findFirst({
    where: { action: "release.attestation_recorded", capabilityId, environment },
    orderBy: { sequence: "desc" },
  })) as AuditEventRow | null) ?? null
}

export async function listAttestations(environment: string, take = 50): Promise<AttestationView[]> {
  const rows = (await db.agentAuditEvent.findMany({ where: { action: "release.attestation_recorded", environment }, orderBy: { sequence: "desc" }, take })) as AuditEventRow[]
  return rows.map(toAttestationView)
}

/** A passed attestation for this capability and environment, recorded within the maximum age. */
export async function hasCurrentAttestation(capabilityId: string, environment: string, now: Date): Promise<boolean> {
  const latest = await findLatestAttestation(capabilityId, environment)
  if (!latest) return false
  const view = toAttestationView(latest)
  return view.passed && now.getTime() - new Date(latest.occurredAt).getTime() <= ATTESTATION_MAX_AGE_MS
}
