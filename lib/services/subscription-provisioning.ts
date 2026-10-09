/**
 * lib/services/subscription-provisioning.ts
 *
 * Phase 5 — Subscription-to-entitlement provisioning engine.
 *
 * Consumes ONLY trusted internal state (UserSubscription + immutable bound
 * PlanVersion + verified billing period from Phase 4) and translates it into
 * subscription-backed EntitlementGrants through the Phase 3 engine. It never
 * touches Razorpay, never processes raw provider webhooks, and never grants
 * access without a verified subscription lifecycle signal.
 *
 * Operations (driven by the Phase-4 lifecycle):
 *   INITIAL_ACTIVATION / RESUME_UPDATE  → create subscription-sourced grants
 *   SUCCESSFUL_RENEWAL / PERIOD_EXTENSION → extend existing grants (never duplicates)
 *   EXPIRATION           → expire grants at the verified paid-through boundary
 *   PAYMENT_HALT_UPDATE  → do not extend; access rides out the existing window
 *   PAUSE_UPDATE         → suspend subscription-sourced grants
 *   CANCELLATION_UPDATE  → period-end: no change (grants expire naturally);
 *                          immediate: revoke subscription-sourced grants
 *   ACCESS_REVOCATION    → revoke all grants of this subscription source
 *
 * Idempotency: every operation has a deterministic dedupeKey
 * (subscriptionId | operation | periodRef) and a durable
 * SubscriptionProvisioning record (unique). Duplicate deliveries collapse;
 * retries reuse the same identity; failed attempts are classified retryable
 * vs permanent and never re-grant a different bundle.
 */

import crypto from "crypto"
import {
  ProvisioningOperation,
  ProvisioningStatus,
  SubscriptionStatus,
  EntitlementSourceType,
} from "@prisma/client"

export { ProvisioningOperation, ProvisioningStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { currentSubscriptionEnvironment } from "@/lib/services/subscription-state-machine"
import { describePlanItemEntitlement } from "@/lib/services/entitlement-lifecycle"
import { EntitlementError } from "@/lib/services/entitlement-lifecycle"
import {
  grantEntitlement,
  revokeEntitlement,
  suspendEntitlement,
  restoreEntitlement,
  expireEntitlementGrant,
  extendEntitlementGrant,
} from "@/lib/services/entitlement-service"
import { subscriptionQueue, SUBSCRIPTION_JOBS } from "@/lib/queue"

// ── Error model ───────────────────────────────────────────────────────────────

export type ProvisioningErrorCode =
  | "PROVISIONING_SUBSCRIPTION_NOT_FOUND"
  | "PROVISIONING_INVALID_OWNER"
  | "PROVISIONING_MISSING_PLAN_VERSION"
  | "PROVISIONING_INVALID_PLAN_VERSION"
  | "PROVISIONING_UNSUPPORTED_ITEM"
  | "PROVISIONING_DEFINITION_MISSING"
  | "PROVISIONING_ENVIRONMENT_MISMATCH"
  | "PROVISIONING_INVALID_PERIOD"
  | "PROVISIONING_OPERATION_CONFLICT"
  | "PROVISIONING_ALREADY_COMPLETED"
  | "PROVISIONING_TRANSIENT"
  | "PROVISIONING_INTERNAL"

export class ProvisioningError extends Error {
  readonly code: ProvisioningErrorCode
  readonly permanent: boolean
  constructor(code: ProvisioningErrorCode, message: string, permanent = true) {
    super(message)
    this.name = "ProvisioningError"
    this.code = code
    this.permanent = permanent
  }
}

const PERMANENT_CODES = new Set<ProvisioningErrorCode>([
  "PROVISIONING_SUBSCRIPTION_NOT_FOUND",
  "PROVISIONING_INVALID_OWNER",
  "PROVISIONING_MISSING_PLAN_VERSION",
  "PROVISIONING_INVALID_PLAN_VERSION",
  "PROVISIONING_UNSUPPORTED_ITEM",
  "PROVISIONING_DEFINITION_MISSING",
  "PROVISIONING_ENVIRONMENT_MISMATCH",
  "PROVISIONING_INVALID_PERIOD",
  "PROVISIONING_ALREADY_COMPLETED",
])

// ── Input & identity ──────────────────────────────────────────────────────────

export interface ProvisioningInput {
  subscriptionId: string
  operation: ProvisioningOperation
  /** Verified event/period reference from Phase 4 (e.g. provider event id or
   *  a stable period key). Drives idempotency; defaults to the subscription
   *  current period string when omitted. */
  periodRef?: string
}

export function buildProvisioningDedupeKey(
  subscriptionId: string,
  operation: ProvisioningOperation,
  periodRef?: string,
): string {
  return crypto
    .createHash("sha256")
    .update(`${subscriptionId}|${operation}|${periodRef ?? ""}`)
    .digest("hex")
}

// ── Resolution (trusted internal records only) ───────────────────────────────

interface ResolvedSubscription {
  id: string
  userId: string
  status: SubscriptionStatus
  environment: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodStart: Date
  currentPeriodEnd: Date
  planVersionId: string | null
  razorpaySubscriptionId: string | null
}

async function resolveSubscription(subscriptionId: string): Promise<ResolvedSubscription> {
  const sub = await db.userSubscription.findUnique({ where: { id: subscriptionId } })
  if (!sub) {
    throw new ProvisioningError(
      "PROVISIONING_SUBSCRIPTION_NOT_FOUND",
      `Unknown subscription: ${subscriptionId}`,
    )
  }
  if (!sub.planVersionId) {
    throw new ProvisioningError(
      "PROVISIONING_MISSING_PLAN_VERSION",
      `Subscription ${subscriptionId} has no bound plan version`,
    )
  }
  return sub as ResolvedSubscription
}

interface ResolvedVersionItem {
  key: string
  type: string
  resourceId: string | null
  limitValue: number | null
  limitUnit: string | null
}

async function resolvePlanVersion(planVersionId: string): Promise<ResolvedVersionItem[]> {
  const version = await db.planVersion.findUnique({
    where: { id: planVersionId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  })
  if (!version) {
    throw new ProvisioningError(
      "PROVISIONING_MISSING_PLAN_VERSION",
      `Unknown plan version: ${planVersionId}`,
    )
  }
  // DRAFT versions are never provisionable; PUBLISHED and superseded (ARCHIVED)
  // versions remain valid for historical subscriptions.
  if (version.status === "DRAFT") {
    throw new ProvisioningError(
      "PROVISIONING_INVALID_PLAN_VERSION",
      `Plan version ${planVersionId} is DRAFT — cannot provision`,
    )
  }

  const environment = currentSubscriptionEnvironment()
  const items: ResolvedVersionItem[] = []
  for (const item of version.items) {
    let descriptor
    try {
      descriptor = describePlanItemEntitlement({
        itemType: item.itemType,
        itemRefId: item.itemRefId,
        itemRefKey: item.itemRefKey,
        limitValue: item.limitValue === null ? null : Number(item.limitValue),
        limitUnit: item.limitUnit,
      })
    } catch {
      throw new ProvisioningError(
        "PROVISIONING_UNSUPPORTED_ITEM",
        `Unsupported plan item ${item.itemType} on version ${planVersionId}`,
      )
    }
    const definition = await db.entitlementDefinition.findUnique({
      where: { key: descriptor.key },
    })
    if (!definition || !definition.isActive) {
      throw new ProvisioningError(
        "PROVISIONING_DEFINITION_MISSING",
        `No active entitlement definition for ${descriptor.key} — record the mapping and retry after catalog fix`,
      )
    }
    items.push({
      key: descriptor.key,
      type: descriptor.type,
      resourceId: descriptor.resourceId,
      limitValue: descriptor.limitValue,
      limitUnit: descriptor.limitUnit,
    })
  }
  return items
}

// ── Grant helpers ─────────────────────────────────────────────────────────────

interface GrantWindow {
  startsAt: Date
  expiresAt: Date | null
}

function grantWindowFor(sub: ResolvedSubscription): GrantWindow {
  const startsAt = sub.currentPeriodStart
  const expiresAt = sub.currentPeriodEnd
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    throw new ProvisioningError("PROVISIONING_INVALID_PERIOD", "Subscription has no valid period start")
  }
  if (expiresAt && (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()))) {
    throw new ProvisioningError("PROVISIONING_INVALID_PERIOD", "Subscription has no valid period end")
  }
  return { startsAt, expiresAt: expiresAt ?? null }
}

async function subscriptionGrants(subscriptionId: string, userId: string): Promise<Array<{ id: string }>> {
  const rows = await db.entitlementGrant.findMany({
    where: {
      subjectType: "USER",
      subjectUserId: userId,
      sourceType: EntitlementSourceType.SUBSCRIPTION,
      sourceReference: subscriptionId,
    },
    select: { id: true },
  })
  return rows as Array<{ id: string }>
}

// ── Core operation ────────────────────────────────────────────────────────────

async function recordAttempt(
  dedupeKey: string,
  patch: {
    status: ProvisioningStatus
    errorCode?: string | null
    errorMessage?: string | null
    startedAt?: Date | null
    finishedAt?: Date | null
    attemptCount?: { increment: number }
    grantCount?: number
    periodStart?: Date | null
    periodEnd?: Date | null
    planVersionId?: string | null
    periodRef?: string | null
  },
) {
  await db.subscriptionProvisioning.update({
    where: { dedupeKey },
    data: patch as never,
  })
}

export interface ProvisioningResult {
  subscriptionId: string
  operation: ProvisioningOperation
  status: ProvisioningStatus
  dedupeKey: string
  grantCount: number
  duplicate: boolean
}

const GRANT_OPS: ReadonlySet<ProvisioningOperation> = new Set([
  ProvisioningOperation.INITIAL_ACTIVATION,
  ProvisioningOperation.RESUME_UPDATE,
  ProvisioningOperation.SUCCESSFUL_RENEWAL,
  ProvisioningOperation.PERIOD_EXTENSION,
])

/**
 * Runs one provisioning operation. Idempotent per (subscription, operation,
 * periodRef). Internal-only — callers must come from verified Phase-4
 * lifecycle signals, never from client input.
 */
export async function provisionSubscription(
  input: ProvisioningInput,
  actorId: string = "subscription-system",
): Promise<ProvisioningResult> {
  const { subscriptionId, operation } = input
  const dedupeKey = buildProvisioningDedupeKey(subscriptionId, operation, input.periodRef)

  const existing = await db.subscriptionProvisioning.findUnique({ where: { dedupeKey } })
  if (existing && existing.status === ProvisioningStatus.SUCCEEDED) {
    return {
      subscriptionId,
      operation,
      status: existing.status,
      dedupeKey,
      grantCount: existing.grantCount,
      duplicate: true,
    }
  }
  if (existing && existing.status === ProvisioningStatus.PROCESSING) {
    throw new ProvisioningError(
      "PROVISIONING_OPERATION_CONFLICT",
      "Provisioning operation is already being processed",
    )
  }
  if (existing && existing.status === ProvisioningStatus.FAILED_PERMANENT) {
    throw new ProvisioningError(
      "PROVISIONING_ALREADY_COMPLETED",
      "Provisioning permanently failed — fix the mapping and use a new period reference",
    )
  }

  // Durable claim (unique dedupeKey under concurrency).
  const attemptCount = (existing?.attemptCount ?? 0) + 1
  if (!existing) {
    try {
      await db.subscriptionProvisioning.create({
        data: {
          subscriptionId,
          operation,
          status: ProvisioningStatus.PROCESSING,
          dedupeKey,
          periodRef: input.periodRef ?? null,
          attemptCount,
          startedAt: new Date(),
        },
      })
    } catch (err) {
      if (err instanceof Error && /Unique constraint/i.test(err.message)) {
        throw new ProvisioningError(
          "PROVISIONING_OPERATION_CONFLICT",
          "Concurrent duplicate provisioning detected",
        )
      }
      throw new ProvisioningError("PROVISIONING_TRANSIENT", "Could not claim provisioning operation", false)
    }
  } else {
    // Retrying a FAILED_RETRYABLE operation reuses the same idempotency
    // identity — no duplicate grants can be produced.
    await db.subscriptionProvisioning.update({
      where: { dedupeKey },
      data: {
        status: ProvisioningStatus.PROCESSING,
        attemptCount,
        startedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    })
  }

  try {
    const sub = await resolveSubscription(subscriptionId)
    if (GRANT_OPS.has(operation) && sub.status !== SubscriptionStatus.ACTIVE) {
      throw new ProvisioningError(
        "PROVISIONING_INVALID_PERIOD",
        `Subscription is ${sub.status}, not ACTIVE — no verified paid service to provision`,
      )
    }
    const owner = await db.user.findUnique({
      where: { id: sub.userId },
      select: { id: true, isBanned: true },
    })
    if (!owner || owner.isBanned) {
      throw new ProvisioningError(
        "PROVISIONING_INVALID_OWNER",
        `Invalid or banned owner for subscription ${subscriptionId}`,
      )
    }

    // Environment isolation (legacy null allowed).
    const environment = currentSubscriptionEnvironment()
    if (sub.environment && sub.environment !== environment) {
      throw new ProvisioningError(
        "PROVISIONING_ENVIRONMENT_MISMATCH",
        `Environment mismatch: subscription is ${sub.environment}, current is ${environment}`,
      )
    }

    const items = await resolvePlanVersion(sub.planVersionId as string)
    const window = grantWindowFor(sub)
    const subject = { type: "USER" as const, userId: sub.userId }

    let grantCount = 0

    const ensureGrant = async (item: ResolvedVersionItem) => {
      const scope = item.resourceId ? "RESOURCE" : "GLOBAL"
      await grantEntitlement(
        {
          entitlementKey: item.key,
          subjectType: "USER",
          subjectUserId: sub.userId,
          sourceType: EntitlementSourceType.SUBSCRIPTION,
          sourceReference: subscriptionId,
          scope: scope as never,
          resourceId: item.resourceId ?? undefined,
          limitValue: item.limitValue ?? undefined,
          limitUnit: item.limitUnit ?? undefined,
          startsAt: window.startsAt,
          expiresAt: window.expiresAt ?? undefined,
        },
        actorId,
      )
      grantCount += 1
    }

    switch (operation) {
      case ProvisioningOperation.INITIAL_ACTIVATION:
      case ProvisioningOperation.RESUME_UPDATE:
        for (const item of items) await ensureGrant(item)
        await emitEvent({
          type: EVENTS.SUBSCRIPTION_ENTITLEMENTS_PROVISIONED,
          timestamp: new Date().toISOString(),
          actorId,
          payload: { subscriptionId, planVersionId: sub.planVersionId, grantCount },
        })
        break

      case ProvisioningOperation.SUCCESSFUL_RENEWAL:
      case ProvisioningOperation.PERIOD_EXTENSION: {
        const existingGrants = await db.entitlementGrant.findMany({
          where: {
            subjectType: "USER",
            subjectUserId: sub.userId,
            sourceType: EntitlementSourceType.SUBSCRIPTION,
            sourceReference: subscriptionId,
            status: "ACTIVE",
          },
          select: { id: true, entitlementKey: true },
        })
        const knownKeys = new Set(existingGrants.map((g) => g.entitlementKey))
        let extended = 0
        let added = 0
        for (const item of items) {
          if (knownKeys.has(item.key)) {
            // extend the ACTIVE grant to the verified new paid-through period
            const grant = existingGrants.find((g) => g.entitlementKey === item.key)
            if (grant) {
              const grantRow = await db.entitlementGrant.findUnique({
                where: { id: grant.id },
                select: { status: true, expiresAt: true },
              })
              if (
                grantRow?.status === "ACTIVE" &&
                window.expiresAt &&
                (!grantRow.expiresAt || window.expiresAt.getTime() > grantRow.expiresAt.getTime())
              ) {
                await extendEntitlementGrant(grant.id, window.expiresAt, actorId, "SUCCESSFUL_RENEWAL")
                extended += 1
              }
            }
          } else {
            await ensureGrant(item)
            added += 1
          }
        }
        grantCount = extended + added
        await emitEvent({
          type: EVENTS.SUBSCRIPTION_ENTITLEMENTS_EXTENDED,
          timestamp: new Date().toISOString(),
          actorId,
          payload: { subscriptionId, planVersionId: sub.planVersionId, extended, periodEnd: window.expiresAt?.toISOString() ?? null },
        })
        break
      }

      case ProvisioningOperation.EXPIRATION: {
        // Guard: never run expiration against a subscription that is still
        // paid through — a stale expiry job cannot shorten a renewed period.
        if (sub.status === SubscriptionStatus.ACTIVE && window.expiresAt && window.expiresAt.getTime() > Date.now()) {
          grantCount = 0
          break
        }
        const rows = await subscriptionGrants(subscriptionId, sub.userId)
        const now = Date.now()
        let expired = 0
        for (const g of rows) {
          const row = await db.entitlementGrant.findUnique({
            where: { id: g.id },
            select: { status: true, expiresAt: true },
          })
          if (!row || row.status !== "ACTIVE") continue
          if (row.expiresAt && row.expiresAt.getTime() <= now) {
            await expireEntitlementGrant(g.id, actorId, "SUBSCRIPTION_EXPIRED")
            expired += 1
          }
        }
        grantCount = expired
        await emitEvent({
          type: EVENTS.SUBSCRIPTION_ENTITLEMENTS_EXPIRED,
          timestamp: new Date().toISOString(),
          actorId,
          payload: { subscriptionId, expired },
        })
        break
      }

      case ProvisioningOperation.PAYMENT_HALT_UPDATE:
        // Default policy: no extension. Existing grants ride out their verified
        // paid-through period and expire at the boundary (EXPIRATION op / worker).
        grantCount = 0
        break

      case ProvisioningOperation.PAUSE_UPDATE: {
        const rows = await subscriptionGrants(subscriptionId, sub.userId)
        let suspended = 0
        for (const g of rows) {
          const row = await db.entitlementGrant.findUnique({
            where: { id: g.id },
            select: { status: true },
          })
          if (row?.status === "ACTIVE") {
            await suspendEntitlement(g.id, actorId, "SUBSCRIPTION_PAUSED")
            suspended += 1
          }
        }
        grantCount = suspended
        break
      }

      case ProvisioningOperation.CANCELLATION_UPDATE: {
        if (sub.cancelAtPeriodEnd) {
          // Access is preserved through the valid paid-through period.
          grantCount = 0
        } else {
          // Immediate cancellation: revoke only this subscription's grants.
          const rows = await subscriptionGrants(subscriptionId, sub.userId)
          let revoked = 0
          for (const g of rows) {
            const row = await db.entitlementGrant.findUnique({
              where: { id: g.id },
              select: { status: true },
            })
            if (row && row.status !== "EXPIRED" && row.status !== "REVOKED") {
              await revokeEntitlement(g.id, actorId, "SUBSCRIPTION_CANCELLED")
              revoked += 1
            }
          }
          grantCount = revoked
        }
        await emitEvent({
          type: EVENTS.SUBSCRIPTION_ENTITLEMENTS_REVOKED,
          timestamp: new Date().toISOString(),
          actorId,
          payload: { subscriptionId, revoked: grantCount },
        })
        break
      }

      case ProvisioningOperation.ACCESS_REVOCATION: {
        const rows = await subscriptionGrants(subscriptionId, sub.userId)
        let revoked = 0
        for (const g of rows) {
          const row = await db.entitlementGrant.findUnique({
            where: { id: g.id },
            select: { status: true },
          })
          if (row && row.status !== "EXPIRED" && row.status !== "REVOKED") {
            await revokeEntitlement(g.id, actorId, "ACCESS_REVOCATION")
            revoked += 1
          }
        }
        grantCount = revoked
        await emitEvent({
          type: EVENTS.SUBSCRIPTION_ENTITLEMENTS_REVOKED,
          timestamp: new Date().toISOString(),
          actorId,
          payload: { subscriptionId, revoked: grantCount },
        })
        break
      }
    }

    await recordAttempt(dedupeKey, {
      status: ProvisioningStatus.SUCCEEDED,
      grantCount,
      planVersionId: sub.planVersionId,
      periodStart: window.startsAt,
      periodEnd: window.expiresAt,
      finishedAt: new Date(),
    })
    return {
      subscriptionId,
      operation,
      status: ProvisioningStatus.SUCCEEDED,
      dedupeKey,
      grantCount,
      duplicate: false,
    }
  } catch (err) {
    const permanent = err instanceof ProvisioningError ? err.permanent : err instanceof EntitlementError
    const code =
      err instanceof ProvisioningError ? err.code : err instanceof EntitlementError ? "PROVISIONING_INTERNAL" : "PROVISIONING_TRANSIENT"
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500)
    const status = permanent ? ProvisioningStatus.FAILED_PERMANENT : ProvisioningStatus.FAILED_RETRYABLE
    await recordAttempt(dedupeKey, {
      status,
      errorCode: code,
      errorMessage: message,
      finishedAt: new Date(),
    }).catch(() => undefined)
    await emitEvent({
      type: EVENTS.SUBSCRIPTION_PROVISIONING_FAILED,
      timestamp: new Date().toISOString(),
      actorId,
      payload: { subscriptionId, operation, code, status },
    }).catch(() => undefined)
    logger.warn({ subscriptionId, operation, code, status }, "subscription provisioning failed")
    throw err
  }
}

// ── Scheduling (reuse BullMQ subscriptionQueue) ───────────────────────────────

export interface ProvisioningJobData extends ProvisioningInput {
  actorId?: string
}

/** Enqueue one provisioning operation for reliable async processing. */
export async function scheduleProvisioning(data: ProvisioningJobData): Promise<void> {
  try {
    await subscriptionQueue.add(SUBSCRIPTION_JOBS.PROVISION_SUBSCRIPTION, data, {
      jobId: buildProvisioningDedupeKey(data.subscriptionId, data.operation, data.periodRef),
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
    })
  } catch (err) {
    // Queue unavailable (lazy no-op queue): run synchronously — intended for
    // dev/test; in production Redis failure is surfaced by the caller.
    logger.warn({ err }, "provisioning queue unavailable, running synchronously")
    await provisionSubscription(data, data.actorId ?? "subscription-system")
  }
}

/** BullMQ worker handler for SUBSCRIPTION_JOBS.PROVISION_SUBSCRIPTION. */
export async function processProvisioningJob(data: ProvisioningJobData): Promise<ProvisioningResult> {
  return provisionSubscription(data, data.actorId ?? "subscription-system")
}
