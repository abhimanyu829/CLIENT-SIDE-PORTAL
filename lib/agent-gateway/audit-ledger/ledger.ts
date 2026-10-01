/**
 * lib/agent-gateway/audit-ledger/ledger.ts
 *
 * Phase 11 — the ONLY reader/writer of AgentAuditEvent.
 *
 * Append: one global chain. The next sequence and the previous digest are
 * read, the event is digested and inserted. Concurrent appenders that read
 * the same head collide on the unique `sequence` (and `eventDigest`)
 * constraint; the loser re-reads the head and retries. Within one process
 * appends are additionally serialized, so contention only arises between
 * processes. There is no update or delete function in this module, no
 * route that edits an event, and the database refuses UPDATE/DELETE with a
 * trigger (see the Phase 11 migration).
 *
 * Verify: walks the chain in sequence order and recomputes every digest
 * and link. A wholesale rewrite by someone with direct database superuser
 * access (trigger dropped, every digest recomputed) is NOT detectable from
 * the chain alone; every verification therefore logs the head sequence and
 * digest as an external anchor (pino -> log pipeline / Sentry), against
 * which a rewritten chain no longer matches. Documented in
 * docs/agent-gateway/phase-11/02-integrity-model.md.
 */
import { randomBytes } from "crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { isValidTraceId } from "../observability/trace-context"
import { gatewayLogger } from "../observability/request-log"
import { computeEventDigest, GENESIS_DIGEST } from "./digest"
import { safeCode, safeDigest, safeIdentifier, sanitizeAuditMetadata } from "./redaction"
import { AUDIT_SCHEMA_VERSION, AuditLedgerUnavailableError, categoryOf, type AuditEventInput, type AuditEventRow } from "./types"

const MAX_APPEND_ATTEMPTS = 8

export function newAuditEventId(): string {
  return `aud_${randomBytes(16).toString("hex")}`
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"
}

const int = (value: number | null | undefined): number | null => (typeof value === "number" && Number.isInteger(value) ? value : null)

/** Sanitizes caller input into the stored column set (no sequence/digests yet). */
export function normalizeAuditInput(input: AuditEventInput, eventId: string, occurredAt: Date) {
  return {
    eventId,
    schemaVersion: AUDIT_SCHEMA_VERSION,
    category: categoryOf(input.action),
    action: input.action,
    outcome: input.outcome,
    occurredAt,
    requestId: safeIdentifier(input.requestId),
    traceId: isValidTraceId(input.traceId) ? input.traceId : null,
    actorType: input.actor.type,
    actorId: safeIdentifier(input.actor.id),
    connectionId: safeIdentifier(input.connectionId),
    agentId: safeIdentifier(input.agentId),
    ownerId: safeIdentifier(input.ownerId),
    teamId: safeIdentifier(input.teamId),
    capabilityId: safeIdentifier(input.capabilityId),
    capabilityVersion: int(input.capabilityVersion),
    riskTier: safeCode(input.riskTier),
    resourceType: safeIdentifier(input.resourceType),
    resourceRef: safeIdentifier(input.resourceRef),
    environment: safeIdentifier(input.environment),
    authorizationDecision: safeCode(input.authorizationDecision),
    authorizationPolicyRef: safeIdentifier(input.authorizationPolicyRef),
    autonomyLevel: safeCode(input.autonomyLevel),
    autonomyPolicyVersion: int(input.autonomyPolicyVersion),
    approvalRef: safeIdentifier(input.approvalRef),
    taskRef: safeIdentifier(input.taskRef),
    triggerRef: safeIdentifier(input.triggerRef),
    adapterId: safeIdentifier(input.adapterId),
    executionStatus: safeCode(input.executionStatus),
    resultCode: safeCode(input.resultCode),
    errorCode: safeCode(input.errorCode),
    inputDigest: safeDigest(input.inputDigest),
    outputDigest: safeDigest(input.outputDigest),
    metadata: sanitizeAuditMetadata(input.metadata),
  }
}

let appendChain: Promise<unknown> = Promise.resolve()

/** In-process serialization of appends (cross-process races are resolved by the unique constraints). */
function serialized<T>(run: () => Promise<T>): Promise<T> {
  const result = appendChain.then(run, run)
  appendChain = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

/**
 * Appends one event. Throws AuditLedgerUnavailableError when it cannot be
 * stored — callers decide (by documented policy) whether that blocks the
 * operation (pre-execution intent for mutations) or is reported only.
 */
export function appendAuditEvent(input: AuditEventInput): Promise<AuditEventRow> {
  const eventId = newAuditEventId()
  const occurredAt = input.occurredAt ?? new Date()
  const base = normalizeAuditInput(input, eventId, occurredAt)
  return serialized(async () => {
    for (let attempt = 1; attempt <= MAX_APPEND_ATTEMPTS; attempt += 1) {
      let head: { sequence: number; eventDigest: string } | null
      try {
        head = (await db.agentAuditEvent.findFirst({ orderBy: { sequence: "desc" }, select: { sequence: true, eventDigest: true } })) as {
          sequence: number
          eventDigest: string
        } | null
      } catch {
        throw new AuditLedgerUnavailableError()
      }
      const sequence = (head?.sequence ?? 0) + 1
      const previousEventDigest = head?.eventDigest ?? GENESIS_DIGEST
      const row = { ...base, sequence, previousEventDigest }
      const eventDigest = computeEventDigest(row)
      try {
        const created = await db.agentAuditEvent.create({
          data: { ...row, metadata: row.metadata === null ? Prisma.DbNull : (row.metadata as Prisma.InputJsonValue), eventDigest },
        })
        return created as unknown as AuditEventRow
      } catch (err) {
        if (isUniqueViolation(err)) continue // another process took this sequence: re-read the head
        throw new AuditLedgerUnavailableError()
      }
    }
    throw new AuditLedgerUnavailableError("The audit ledger is busy; the event could not be appended.")
  })
}

/** The most recent event of one action (read only; e.g. the last recorded registry fingerprint). */
export async function findLatestEventByAction(action: AuditEventInput["action"]): Promise<AuditEventRow | null> {
  return ((await db.agentAuditEvent.findFirst({ where: { action }, orderBy: { sequence: "desc" } })) as AuditEventRow | null) ?? null
}

export async function findAuditEventByEventId(eventId: string): Promise<AuditEventRow | null> {
  if (!/^aud_[0-9a-f]{32}$/.test(eventId)) return null
  return ((await db.agentAuditEvent.findUnique({ where: { eventId } })) as AuditEventRow | null) ?? null
}

export type ChainFailureReason = "SEQUENCE_GAP" | "BROKEN_LINK" | "DIGEST_MISMATCH" | "DUPLICATE_EVENT_ID" | "UNKNOWN_SCHEMA"

export interface ChainVerificationReport {
  ok: boolean
  checked: number
  fromSequence: number
  lastVerifiedSequence: number | null
  headSequence: number | null
  headDigest: string | null
  truncated: boolean
  failure?: { sequence: number; eventId?: string; reason: ChainFailureReason }
}

/** Recomputes one stored event's digest (does not check its link). */
export function eventDigestMatches(row: AuditEventRow): boolean {
  if (row.schemaVersion !== AUDIT_SCHEMA_VERSION) return false
  return computeEventDigest(row) === row.eventDigest
}

/**
 * Verifies the chain from `fromSequence` (default 1) for at most
 * `maxEvents` events. Never modifies anything. A store failure throws
 * AuditLedgerUnavailableError (an unverifiable chain is not "ok").
 */
export async function verifyAuditChain(options: { fromSequence?: number; maxEvents?: number; batchSize?: number } = {}): Promise<ChainVerificationReport> {
  const fromSequence = Math.max(1, Math.floor(options.fromSequence ?? 1))
  const maxEvents = Math.max(1, Math.floor(options.maxEvents ?? 50_000))
  const batchSize = Math.min(1_000, Math.max(1, Math.floor(options.batchSize ?? 500)))
  const report: ChainVerificationReport = {
    ok: true,
    checked: 0,
    fromSequence,
    lastVerifiedSequence: null,
    headSequence: null,
    headDigest: null,
    truncated: false,
  }
  const fail = (sequence: number, reason: ChainFailureReason, eventId?: string): ChainVerificationReport => {
    report.ok = false
    report.failure = { sequence, reason, ...(eventId ? { eventId } : {}) }
    return report
  }

  try {
    const head = (await db.agentAuditEvent.findFirst({ orderBy: { sequence: "desc" }, select: { sequence: true, eventDigest: true } })) as {
      sequence: number
      eventDigest: string
    } | null
    report.headSequence = head?.sequence ?? null
    report.headDigest = head?.eventDigest ?? null

    let expectedPrevious = GENESIS_DIGEST
    if (fromSequence > 1) {
      const anchor = (await db.agentAuditEvent.findUnique({ where: { sequence: fromSequence - 1 } })) as AuditEventRow | null
      if (!anchor) return fail(fromSequence - 1, "SEQUENCE_GAP")
      expectedPrevious = anchor.eventDigest
    }
    let expectedSequence = fromSequence
    const seen = new Set<string>()
    while (report.checked < maxEvents) {
      const take = Math.min(batchSize, maxEvents - report.checked)
      const rows = (await db.agentAuditEvent.findMany({
        where: { sequence: { gte: expectedSequence } },
        orderBy: { sequence: "asc" },
        take,
      })) as AuditEventRow[]
      if (rows.length === 0) break
      for (const row of rows) {
        if (row.sequence !== expectedSequence) return fail(expectedSequence, "SEQUENCE_GAP")
        if (seen.has(row.eventId)) return fail(row.sequence, "DUPLICATE_EVENT_ID", row.eventId)
        seen.add(row.eventId)
        if (row.schemaVersion !== AUDIT_SCHEMA_VERSION) return fail(row.sequence, "UNKNOWN_SCHEMA", row.eventId)
        if (row.previousEventDigest !== expectedPrevious) return fail(row.sequence, "BROKEN_LINK", row.eventId)
        if (computeEventDigest(row) !== row.eventDigest) return fail(row.sequence, "DIGEST_MISMATCH", row.eventId)
        expectedPrevious = row.eventDigest
        report.lastVerifiedSequence = row.sequence
        expectedSequence += 1
        report.checked += 1
      }
      if (rows.length < take) break
    }
    if (report.checked >= maxEvents && report.headSequence !== null && (report.lastVerifiedSequence ?? 0) < report.headSequence) {
      report.truncated = true
    }
  } catch (err) {
    if (err instanceof AuditLedgerUnavailableError) throw err
    throw new AuditLedgerUnavailableError("The audit ledger could not be read for verification.")
  }

  // External anchor: the head as observed at verification time.
  gatewayLogger.info(
    {
      ok: report.ok,
      checked: report.checked,
      headSequence: report.headSequence,
      headDigest: report.headDigest,
      failureReason: report.failure?.reason ?? null,
      failureSequence: report.failure?.sequence ?? null,
    },
    "agent_gateway_audit_chain_verified"
  )
  return report
}

export interface AuditEventQuery {
  category?: string
  connectionId?: string
  capabilityId?: string
  taskRef?: string
  traceId?: string
  requestId?: string
  since?: Date
  skip?: number
  take?: number
}

/** Read model for governance (newest first). */
export async function listAuditEvents(query: AuditEventQuery): Promise<{ rows: AuditEventRow[]; total: number }> {
  const where: Record<string, unknown> = {}
  if (query.category) where.category = query.category
  if (query.connectionId) where.connectionId = query.connectionId
  if (query.capabilityId) where.capabilityId = query.capabilityId
  if (query.taskRef) where.taskRef = query.taskRef
  if (query.traceId) where.traceId = query.traceId
  if (query.requestId) where.requestId = query.requestId
  if (query.since) where.occurredAt = { gte: query.since }
  const [rows, total] = await Promise.all([
    db.agentAuditEvent.findMany({ where, orderBy: { sequence: "desc" }, skip: query.skip ?? 0, take: Math.min(query.take ?? 20, 100) }),
    db.agentAuditEvent.count({ where }),
  ])
  return { rows: rows as AuditEventRow[], total }
}
