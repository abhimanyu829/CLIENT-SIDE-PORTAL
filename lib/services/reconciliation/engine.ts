/**
 * lib/services/reconciliation/engine.ts
 *
 * Phase 10 — Reconciliation run engine. Bounded, resumable-safe (single active
 * run), mode-gated, idempotent via unique findingKey, repairs ONLY through
 * existing Phase 3/5/6 services with postcondition verification. Never mutates
 * financial history, never marks payments successful, never bypasses Phase-4
 * verification.
 */

import crypto from "crypto"
import {
  ReconciliationCategory,
  ReconciliationFindingStatus,
  ReconciliationMode,
  ProvisioningOperation,
  ReconciliationRunStatus,
  ReconciliationSeverity,
} from "@prisma/client"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import {
  DEFAULT_THRESHOLDS,
  type FindingDraft,
  type ReconciliationThresholds,
  ruleChargeRecords,
  ruleEntitlementConsistency,
  ruleProvisioning,
  ruleSubscriptionLifecycle,
  ruleTrialExpiry,
  ruleUnprocessedEvents,
} from "./rules"
import { provisionSubscription } from "@/lib/services/subscription-provisioning"
import { expireExpiredTrials } from "@/lib/services/free-trial-service"
import { expireEntitlementGrant } from "@/lib/services/entitlement-service"

export type RepairActionId =
  | "REPROCESS_PROVISIONING"
  | "EXPIRE_STALE_TRIALS"
  | "EXPIRE_STALE_GRANT"
  | "REVOKE_SUBSCRIPTION_GRANTS"

/**
 * SAFE_AUTO allow-list. Each action is idempotent under its existing domain
 * service and has a verified postcondition. Anything else is detection-only or
 * requires an approved/manual workflow.
 */
const SAFE_AUTO_REPAIRS: ReadonlySet<RepairActionId> = new Set([
  "REPROCESS_PROVISIONING",
  "EXPIRE_STALE_TRIALS",
  "EXPIRE_STALE_GRANT",
  "REVOKE_SUBSCRIPTION_GRANTS",
])

export interface ReconciliationRunInput {
  mode: ReconciliationMode
  actorId: string
  scope?: string
  batchSize?: number
  thresholds?: ReconciliationThresholds
  correlationId?: string
}

export interface ReconciliationRunResult {
  runId: string
  mode: ReconciliationMode
  status: ReconciliationRunStatus
  scanned: number
  findings: number
  newFindings: number
  repaired: number
  proposed: number
  escalated: number
  errors: number
}

const ACTIVE_RUN_STALE_MS = 30 * 60_000

export async function runReconciliation(input: ReconciliationRunInput): Promise<ReconciliationRunResult> {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS
  const batchSize = Math.min(500, Math.max(10, input.batchSize ?? 200))
  const now = new Date()

  // Single active run guard (crash-safe: a RUNNING row older than the window
  // is marked interrupted so a new run may proceed).
  const active = await db.reconciliationRun.findFirst({
    where: { status: ReconciliationRunStatus.RUNNING },
    orderBy: { startedAt: "desc" },
  })
  if (active) {
    if (now.getTime() - active.startedAt.getTime() < ACTIVE_RUN_STALE_MS) {
      return {
        runId: active.id,
        mode: active.mode,
        status: active.status,
        scanned: active.scanned,
        findings: active.findingsCount,
        newFindings: 0,
        repaired: active.repairedCount,
        proposed: 0,
        escalated: 0,
        errors: active.errorCount,
      }
    }
    await db.reconciliationRun.update({
      where: { id: active.id },
      data: {
        status: ReconciliationRunStatus.FAILED,
        errorCode: "INTERRUPTED",
        errorMessage: "Run exceeded the active window without completing; superseded.",
        finishedAt: new Date(),
      },
    })
  }

  const run = await db.reconciliationRun.create({
    data: {
      mode: input.mode,
      status: ReconciliationRunStatus.RUNNING,
      scope: input.scope ?? null,
      actorId: input.actorId,
      correlationId: input.correlationId ?? crypto.randomUUID(),
      config: {
        batchSize,
        thresholds,
        providerEvidence: "INTERNAL_ONLY (no verified provider settlement/lookup credentials configured)",
      } as never,
      startedAt: now,
    },
  })

  const counters = { scanned: 0, findings: 0, newFindings: 0, repaired: 0, proposed: 0, escalated: 0, errors: 0 }
  const drafts: FindingDraft[] = []

  try {
    // ── Detection (bounded, per category) ────────────────────────────────────
    const [webhookEvents, charges, subscriptions, provisionings, grants, trials, subStates] = await Promise.all([
      db.webhookEvent.findMany({
        where: { source: "RAZORPAY", status: { in: ["PENDING", "FAILED"] } },
        orderBy: { createdAt: "asc" },
        take: batchSize,
      }),
      db.subscriptionCharge.findMany({ orderBy: { createdAt: "asc" }, take: batchSize }),
      db.userSubscription.findMany({
        where: { status: { in: ["TRIALING", "UNPAID", "ACTIVE"] } },
        orderBy: { updatedAt: "asc" },
        take: batchSize,
      }),
      db.subscriptionProvisioning.findMany({
        where: { status: { in: ["FAILED_RETRYABLE", "FAILED_PERMANENT"] } },
        orderBy: { createdAt: "asc" },
        take: batchSize,
      }),
      db.entitlementGrant.findMany({
        where: { sourceType: "SUBSCRIPTION", status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: batchSize,
      }),
      db.trialEnrollment.findMany({
        where: { status: "ACTIVE" },
        orderBy: { expiresAt: "asc" },
        take: batchSize,
      }),
      db.userSubscription.findMany({
        where: { status: { in: ["CANCELED", "EXPIRED"] } },
        select: { id: true, status: true },
        take: batchSize,
      }),
    ])

    counters.scanned =
      webhookEvents.length + charges.length + subscriptions.length +
      provisionings.length + grants.length + trials.length

    // Category A — events
    drafts.push(
      ...ruleUnprocessedEvents(
        webhookEvents.map((e) => ({ eventId: e.eventId, eventType: e.eventType, status: e.status, receivedAt: e.createdAt, errorMessage: e.errorMessage })),
        now,
        thresholds,
      ),
    )
    // Category B — charges (provider settlement lookup unavailable: recorded once below)
    drafts.push(
      ...ruleChargeRecords(
        charges.map((c) => ({ id: c.id, razorpaySubscriptionId: c.razorpaySubscriptionId, razorpayPaymentId: c.razorpayPaymentId, amountSubunits: c.amountSubunits, currency: c.currency, chargeStatus: c.chargeStatus, createdAt: c.createdAt })),
        now,
        thresholds,
      ),
    )
    // Category C — subscription lifecycle
    drafts.push(
      ...ruleSubscriptionLifecycle(
        subscriptions.map((s) => ({ id: s.id, userId: s.userId, status: s.status, planVersionId: s.planVersionId, razorpaySubscriptionId: s.razorpaySubscriptionId, currentPeriodStart: s.currentPeriodStart, currentPeriodEnd: s.currentPeriodEnd, updatedAt: s.updatedAt })),
        now,
        thresholds,
      ),
    )
    // Category E — provisioning + grants + trials
    drafts.push(
      ...ruleProvisioning(
        provisionings.map((p) => ({ id: p.id, subscriptionId: p.subscriptionId, operation: p.operation, periodRef: p.periodRef, status: p.status, attemptCount: p.attemptCount, errorCode: p.errorCode, updatedAt: p.updatedAt })),
        now,
        thresholds,
      ),
      ...ruleEntitlementConsistency(
        grants.map((g) => ({ id: g.id, entitlementKey: g.entitlementKey, sourceType: g.sourceType, sourceReference: g.sourceReference, status: g.status, expiresAt: g.expiresAt })),
        subStates.map((s) => ({ id: s.id, status: s.status })),
        now,
      ),
      ...ruleTrialExpiry(
        trials.map((t) => ({ id: t.id, userId: t.userId, status: t.status, expiresAt: t.expiresAt })),
        now,
      ),
    )

    // Honest evidence gap: external settlement/lookup comparison is unavailable.
    drafts.push({
      findingKey: `${ReconciliationCategory.EXTERNAL_PROVIDER_UNAVAILABLE}:Provider:razorpay_lookup:UNAVAILABLE`,
      category: ReconciliationCategory.EXTERNAL_PROVIDER_UNAVAILABLE,
      severity: ReconciliationSeverity.LOW,
      entityType: "Provider",
      entityId: "razorpay_lookup",
      expectedValue: { providerEvidence: "available" },
      observedValue: { providerEvidence: "unavailable" },
      evidence: { note: "No verified Razorpay TEST credentials configured; settlement/lookup comparison not performed. Category F (settlement) unsupported." },
      proposedAction: null,
    })

    // ── Persist findings idempotently ────────────────────────────────────────
    for (const draft of drafts) {
      counters.findings += 1
      try {
        const existing = await db.reconciliationFinding.findUnique({ where: { findingKey: draft.findingKey } })
        if (existing) {
          const reopen = existing.status === ReconciliationFindingStatus.RESOLVED
          await db.reconciliationFinding.update({
            where: { findingKey: draft.findingKey },
            data: {
              runId: run.id,
              lastObservedAt: now,
              ...(reopen ? { status: ReconciliationFindingStatus.NEW, resolvedAt: null, attempts: { increment: 1 } } : {}),
            },
          })
          continue
        }
        const created = await db.reconciliationFinding.create({
          data: {
            runId: run.id,
            findingKey: draft.findingKey,
            category: draft.category,
            severity: draft.severity,
            entityType: draft.entityType,
            entityId: draft.entityId,
            expectedValue: (draft.expectedValue ?? {}) as never,
            observedValue: (draft.observedValue ?? {}) as never,
            evidence: draft.evidence as never,
            proposedAction: draft.proposedAction,
            status: input.mode === ReconciliationMode.DRY_RUN && draft.proposedAction
              ? ReconciliationFindingStatus.ACTION_PROPOSED
              : ReconciliationFindingStatus.NEW,
          },
        })
        counters.newFindings += 1

        // ── Mode-gated repair ────────────────────────────────────────────────
        const canAttempt =
          draft.proposedAction !== null &&
          SAFE_AUTO_REPAIRS.has(draft.proposedAction as RepairActionId) &&
          (input.mode === ReconciliationMode.SAFE_AUTO_REPAIR ||
            input.mode === ReconciliationMode.APPROVED_REPAIR)

        if (input.mode === ReconciliationMode.DRY_RUN && draft.proposedAction) {
          counters.proposed += 1
          continue
        }
        if (input.mode === ReconciliationMode.MANUAL_INVESTIGATION) {
          counters.escalated += 1
          await db.reconciliationFinding.update({
            where: { id: created.id },
            data: { status: ReconciliationFindingStatus.ESCALATED, resolutionNote: "Routed to manual investigation (mode)." },
          })
          continue
        }
        if (!canAttempt) continue

        const outcome = await attemptRepair(created.id, draft.proposedAction as RepairActionId, input.actorId, draft.evidence)
        if (outcome === "RESOLVED") counters.repaired += 1
        else if (outcome === "PROPOSED") counters.proposed += 1
        else if (outcome === "ESCALATED") counters.escalated += 1
        else counters.errors += 1
      } catch (err) {
        counters.errors += 1
        logger.error({ err, findingKey: draft.findingKey }, "reconciliation finding processing failed")
      }
    }

    await db.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: ReconciliationRunStatus.COMPLETED,
        scanned: counters.scanned,
        findingsCount: counters.findings,
        repairedCount: counters.repaired,
        skippedCount: counters.proposed + counters.escalated,
        errorCount: counters.errors,
        finishedAt: new Date(),
      },
    })
    await auditRun(input.actorId, run.id, input.mode, counters)

    return { runId: run.id, mode: input.mode, status: ReconciliationRunStatus.COMPLETED, ...counters, findings: counters.findings, proposed: counters.proposed }
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500)
    await db.reconciliationRun
      .update({
        where: { id: run.id },
        data: { status: ReconciliationRunStatus.FAILED, errorCode: "RUN_FAILED", errorMessage: message, errorCount: counters.errors + 1, finishedAt: new Date() },
      })
      .catch(() => undefined)
    logger.error({ err, runId: run.id }, "reconciliation run failed")
    throw err
  }
}

// ── Repair execution + postcondition verification ────────────────────────────

type RepairOutcome = "RESOLVED" | "PROPOSED" | "ESCALATED" | "FAILED"

async function attemptRepair(
  findingId: string,
  action: RepairActionId,
  actorId: string,
  evidence: Record<string, unknown>,
): Promise<RepairOutcome> {
  const finding = await db.reconciliationFinding.findUnique({ where: { id: findingId } })
  if (!finding) return "FAILED"
  // Revalidate current state immediately before execution (stale-scan defense).
  const fresh = await db.reconciliationFinding.findUnique({ where: { id: findingId } })
  if (!fresh || fresh.status === ReconciliationFindingStatus.RESOLVED) return "RESOLVED"

  await db.reconciliationFinding.update({
    where: { id: findingId },
    data: { status: ReconciliationFindingStatus.REPAIR_IN_PROGRESS, attempts: { increment: 1 } },
  })

  try {
    let operationRef = ""
    switch (action) {
      case "REPROCESS_PROVISIONING": {
        const subscriptionId = String(evidence.subscriptionId ?? "")
        const operation = String(evidence.operation ?? "")
        const periodRef = (evidence.periodRef as string | null) ?? undefined
        if (!subscriptionId || !operation) return failRepair(findingId, "missing provisioning identity")
        // Idempotent: Phase-5 reuses the FAILED_RETRYABLE record's identity.
        const result = await provisionSubscription({ subscriptionId, operation: operation as ProvisioningOperation, periodRef }, actorId)
        operationRef = result.dedupeKey
        const row = await db.subscriptionProvisioning.findUnique({ where: { dedupeKey: operationRef } })
        if (row?.status !== "SUCCEEDED") return failRepair(findingId, "provisioning did not reach SUCCEEDED")
        break
      }
      case "EXPIRE_STALE_TRIALS": {
        const before = await db.trialEnrollment.findFirst({ where: { id: String(finding.entityId), status: "ACTIVE" } })
        if (!before) return "RESOLVED" // already expired = postcondition met
        await expireExpiredTrials(new Date(), actorId)
        const after = await db.trialEnrollment.findUnique({ where: { id: String(finding.entityId) } })
        if (after?.status !== "EXPIRED") return failRepair(findingId, "trial not EXPIRED after sweep")
        operationRef = String(finding.entityId)
        break
      }
      case "EXPIRE_STALE_GRANT": {
        const grant = await db.entitlementGrant.findUnique({ where: { id: String(finding.entityId) } })
        if (!grant) return "RESOLVED"
        if (grant.status !== "ACTIVE") {
          operationRef = grant.id
          break
        }
        const expResult = await expireEntitlementGrant(grant.id, actorId, "RECONCILIATION_EXPIRY")
        if (expResult.status !== "EXPIRED") return failRepair(findingId, "grant not EXPIRED after operation")
        operationRef = grant.id
        break
      }
      case "REVOKE_SUBSCRIPTION_GRANTS": {
        const subscriptionId = String(evidence.sourceReference ?? "")
        if (!subscriptionId) return failRepair(findingId, "missing source reference")
        const result = await provisionSubscription(
          { subscriptionId, operation: ProvisioningOperation.ACCESS_REVOCATION, periodRef: `recon:${findingId}` },
          actorId,
        )
        operationRef = result.dedupeKey
        const grant = await db.entitlementGrant.findUnique({ where: { id: String(finding.entityId) } })
        if (grant && grant.status === "ACTIVE") return failRepair(findingId, "grant still ACTIVE after revocation")
        break
      }
      default:
        return "ESCALATED"
    }

    await db.reconciliationFinding.update({
      where: { id: findingId },
      data: {
        status: ReconciliationFindingStatus.RESOLVED,
        resolvedAt: new Date(),
        actionStatus: "VERIFIED",
        repairOperationRef: operationRef,
        resolutionNote: `Postcondition verified via existing domain service (${action}).`,
      },
    })
    await auditRepair(actorId, findingId, action, operationRef)
    return "RESOLVED"
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn({ err, findingId, action }, "reconciliation repair failed")
    return failRepair(findingId, message.slice(0, 300))
  }
}

async function failRepair(findingId: string, note: string): Promise<RepairOutcome> {
  await db.reconciliationFinding
    .update({
      where: { id: findingId },
      data: { status: ReconciliationFindingStatus.FAILED, actionStatus: "FAILED", resolutionNote: note },
    })
    .catch(() => undefined)
  return "FAILED"
}

async function auditRun(actorId: string, runId: string, mode: ReconciliationMode, counters: Record<string, number>): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: actorId,
        action: "RECONCILIATION_RUN_COMPLETED",
        entity: "ReconciliationRun",
        entityId: runId,
        afterJson: { mode, ...counters } as never,
      },
    })
  } catch {
    // Run completion audit is best-effort for non-repair runs; repairs audit
    // individually (fail-safe for sensitive ops is handled per-repair).
  }
}

async function auditRepair(actorId: string, findingId: string, action: RepairActionId, operationRef: string): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "RECONCILIATION_REPAIR_APPLIED",
      entity: "ReconciliationFinding",
      entityId: findingId,
      afterJson: { action, operationRef, verified: true } as never,
    },
  })
}

export { SAFE_AUTO_REPAIRS }

/**
 * Admin-triggered single-finding repair (APPROVED_REPAIR path). Revalidates
 * the finding and its action, then runs the same verified repair pipeline.
 */
export async function repairFindingById(findingId: string, actorId: string): Promise<{ outcome: RepairOutcome; status: string }> {
  const finding = await db.reconciliationFinding.findUnique({ where: { id: findingId } })
  if (!finding) throw new Error("Finding not found")
  if (finding.status === ReconciliationFindingStatus.RESOLVED) {
    return { outcome: "RESOLVED", status: finding.status }
  }
  const action = finding.proposedAction as RepairActionId | null
  if (!action || !SAFE_AUTO_REPAIRS.has(action)) {
    await db.reconciliationFinding.update({
      where: { id: findingId },
      data: { status: ReconciliationFindingStatus.ESCALATED, resolutionNote: "No safe automatic repair for this category." },
    })
    return { outcome: "ESCALATED", status: ReconciliationFindingStatus.ESCALATED }
  }
  const outcome = await attemptRepair(findingId, action, actorId, finding.evidence as Record<string, unknown>)
  const after = await db.reconciliationFinding.findUnique({ where: { id: findingId } })
  return { outcome, status: after?.status ?? finding.status }
}
