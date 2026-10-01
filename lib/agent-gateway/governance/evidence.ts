/**
 * lib/agent-gateway/governance/evidence.ts
 *
 * Phase 11 governance: the audit ledger (read + chain verification) and
 * capability-aware recovery requests. SUPER_ADMIN only (enforced by the
 * pages' requireGovernanceViewer and the routes' requireGovernanceOperator).
 * Nothing here edits or deletes a ledger event — there is no such function.
 */
import { listAuditEvents, verifyAuditChain, type ChainVerificationReport } from "../audit-ledger/ledger"
import { AUDIT_CATEGORIES, type AuditEventRow } from "../audit-ledger/types"
import { createRecoveryService, findRecoveryByRef, listRecoveries, toRecoveryView, type RecoveryView } from "../recovery"
import { GOVERNANCE_AUDIT_ACTIONS, recordGovernanceAudit } from "./audit"
import { GovernanceError } from "./errors"
import { PAGE_SIZE, pageMeta, skipFor, type Paged } from "./pagination"

/** What an administrator sees of a ledger event (all of it is already non-secret by construction). */
export interface AuditEventAdminView {
  eventId: string
  sequence: number
  category: string
  action: string
  outcome: string
  /** ISO-8601 (UTC). */
  occurredAt: string
  actorType: string
  actorId: string | null
  requestId: string | null
  traceId: string | null
  connectionId: string | null
  capabilityId: string | null
  capabilityVersion: number | null
  riskTier: string | null
  resourceType: string | null
  resourceRef: string | null
  environment: string | null
  authorizationDecision: string | null
  authorizationPolicyRef: string | null
  autonomyLevel: string | null
  approvalRef: string | null
  taskRef: string | null
  triggerRef: string | null
  resultCode: string | null
  errorCode: string | null
  inputDigestPrefix: string | null
  outputDigestPrefix: string | null
  eventDigestPrefix: string
  /** True when this is a successful execution of a write (a recovery candidate). */
  recoverable: boolean
}

export function toAuditEventAdminView(row: AuditEventRow): AuditEventAdminView {
  return {
    eventId: row.eventId,
    sequence: row.sequence,
    category: row.category,
    action: row.action,
    outcome: row.outcome,
    occurredAt: new Date(row.occurredAt).toISOString(),
    actorType: row.actorType,
    actorId: row.actorId,
    requestId: row.requestId,
    traceId: row.traceId,
    connectionId: row.connectionId,
    capabilityId: row.capabilityId,
    capabilityVersion: row.capabilityVersion,
    riskTier: row.riskTier,
    resourceType: row.resourceType,
    resourceRef: row.resourceRef,
    environment: row.environment,
    authorizationDecision: row.authorizationDecision,
    authorizationPolicyRef: row.authorizationPolicyRef,
    autonomyLevel: row.autonomyLevel,
    approvalRef: row.approvalRef,
    taskRef: row.taskRef,
    triggerRef: row.triggerRef,
    resultCode: row.resultCode,
    errorCode: row.errorCode,
    inputDigestPrefix: row.inputDigest ? row.inputDigest.slice(0, 12) : null,
    outputDigestPrefix: row.outputDigest ? row.outputDigest.slice(0, 12) : null,
    eventDigestPrefix: row.eventDigest.slice(0, 12),
    recoverable: row.action === "execution.succeeded" && !!row.riskTier && row.riskTier !== "READ",
  }
}

export const LEDGER_CATEGORY_FILTERS = AUDIT_CATEGORIES

export interface LedgerFilters {
  category?: string
  connectionId?: string
  capabilityId?: string
  taskRef?: string
  traceId?: string
  page: number
}

export async function listLedgerEvents(filters: LedgerFilters): Promise<Paged<AuditEventAdminView>> {
  const { rows, total } = await listAuditEvents({
    category: filters.category,
    connectionId: filters.connectionId,
    capabilityId: filters.capabilityId,
    taskRef: filters.taskRef,
    traceId: filters.traceId,
    skip: skipFor(filters.page),
    take: PAGE_SIZE,
  })
  return { rows: rows.map(toAuditEventAdminView), meta: pageMeta(total, filters.page) }
}

export async function listRecoveryViews(page: number): Promise<Paged<RecoveryView>> {
  const { rows, total } = await listRecoveries(skipFor(page), PAGE_SIZE)
  return { rows: rows.map(toRecoveryView), meta: pageMeta(total, page) }
}

export async function getRecoveryView(ref: string): Promise<RecoveryView | null> {
  const row = await findRecoveryByRef(ref)
  return row ? toRecoveryView(row) : null
}

export async function requestRecoveryAction(body: { eventId: string; reason: string }, actorId: string, req?: Request): Promise<RecoveryView> {
  const view = await createRecoveryService().requestRecovery(body, { userId: actorId })
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.RECOVERY_REQUESTED,
    entity: "AgentRecovery",
    entityId: view.recoveryRef,
    after: { status: view.status, recoveryClass: view.recoveryClass, sourceEventId: view.sourceEventId },
    reason: body.reason,
    req,
  })
  return view
}

export async function verifyLedgerAction(body: { fromSequence?: number; maxEvents?: number }, actorId: string, req?: Request): Promise<ChainVerificationReport> {
  let report: ChainVerificationReport
  try {
    report = await verifyAuditChain({ fromSequence: body.fromSequence, maxEvents: body.maxEvents })
  } catch {
    throw new GovernanceError("UNAVAILABLE", "The audit ledger could not be read. Verification did not run.")
  }
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.LEDGER_VERIFIED,
    entity: "AgentAuditEvent",
    entityId: report.headSequence === null ? "empty" : `seq-${report.headSequence}`,
    after: { ok: report.ok, checked: report.checked, lastVerifiedSequence: report.lastVerifiedSequence ?? 0, brokenAt: report.failure?.sequence ?? 0 },
    req,
  })
  return report
}
