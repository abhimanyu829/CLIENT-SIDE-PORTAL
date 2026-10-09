/**
 * lib/services/free-trial-service.ts
 *
 * Phase 6 — Free Forever + 14-day trial engine.
 *
 * Additive access sources on top of the Phase-3 Entitlement Engine:
 *   - Free Forever enrollment → grants with sourceType FREE_PLAN
 *   - 14-day trial enrollment → grants with sourceType TRIAL
 *
 * All plan-item → entitlement mapping reuses the Phase-3 contract; all grant
 * writes go through Phase-3 services; all caches invalidate through Phase-3
 * helpers. No Razorpay, no checkout, no second engine, no UI.
 */

import crypto from "crypto"
import {
  EntitlementSourceType,
  FreeEnrollmentStatus,
  PlanStatus,
  PlanType,
  PlanVersionStatus,
  TrialStatus,
} from "@prisma/client"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { currentSubscriptionEnvironment } from "@/lib/services/subscription-state-machine"
import { grantEntitlement, expireEntitlementGrant } from "@/lib/services/entitlement-service"
import { describePlanItemEntitlement } from "@/lib/services/entitlement-lifecycle"
import {
  FreeTrialError,
  buildFreeEnrollmentKey,
  buildTrialScopeKey,
  evaluateTrialEligibility,
  isBillablePlanType,
  isTrialExpiredAt,
  trialExpiresAtFor,
} from "@/lib/services/free-trial-lifecycle"
import { subscriptionQueue, SUBSCRIPTION_JOBS } from "@/lib/queue"

// ── Shared provisioning helper ────────────────────────────────────────────────

interface ProvisionPlanGrantsInput {
  userId: string
  planVersionId: string
  sourceType: EntitlementSourceType
  sourceReference: string
  expiresAt: Date | null
  actorId: string
}

/** Provisions every item of an immutable plan version as source-bound grants.
 *  Validates ALL definitions first — unsupported/missing items abort before
 *  any grant (no partial bundles, no false success). */
export async function provisionPlanGrants(input: ProvisionPlanGrantsInput): Promise<number> {
  const version = await db.planVersion.findUnique({
    where: { id: input.planVersionId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  })
  if (!version || version.status === PlanVersionStatus.DRAFT) {
    throw new FreeTrialError("INVALID_PLAN_VERSION", `Invalid plan version: ${input.planVersionId}`)
  }

  const descriptors = version.items.map((item) =>
    describePlanItemEntitlement({
      itemType: item.itemType,
      itemRefId: item.itemRefId,
      itemRefKey: item.itemRefKey,
      limitValue: item.limitValue === null ? null : Number(item.limitValue),
      limitUnit: item.limitUnit,
    }),
  )

  for (const d of descriptors) {
    const definition = await db.entitlementDefinition.findUnique({ where: { key: d.key } })
    if (!definition || !definition.isActive) {
      throw new FreeTrialError(
        "ENTITLEMENT_PROVISIONING_FAILED",
        `No active entitlement definition for ${d.key}`,
      )
    }
  }

  const now = new Date()
  let count = 0
  for (const d of descriptors) {
    await grantEntitlement(
      {
        entitlementKey: d.key,
        subjectType: "USER",
        subjectUserId: input.userId,
        sourceType: input.sourceType,
        sourceReference: input.sourceReference,
        scope: d.resourceId ? ("RESOURCE" as never) : ("GLOBAL" as never),
        resourceId: d.resourceId ?? undefined,
        limitValue: d.limitValue ?? undefined,
        limitUnit: d.limitUnit ?? undefined,
        startsAt: now,
        expiresAt: input.expiresAt ?? undefined,
      },
      input.actorId,
    )
    count += 1
  }
  return count
}

// ── Free Forever ──────────────────────────────────────────────────────────────

export interface FreeEnrollmentResult {
  enrollmentId: string
  planId: string
  planVersionId: string
  grantCount: number
  existing: boolean
}

/**
 * Enrolls an authenticated customer in the published FREE plan. Creates/returns
 * the enrollment idempotently and provisions FREE_PLAN grants (permanent).
 * Never creates a payment or a paid subscription.
 */
export async function enrollFreePlan(userId: string, actorId: string = "system"): Promise<FreeEnrollmentResult> {
  if (!userId) throw new FreeTrialError("TRIAL_NOT_ELIGIBLE", "An authenticated customer is required")

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, isBanned: true } })
  if (!user || user.isBanned) {
    throw new FreeTrialError("TRIAL_NOT_ELIGIBLE", "Unknown or banned customer")
  }

  // Resolve the published FREE plan + its published version.
  const plan = await db.subscriptionPlan.findFirst({
    where: { planType: PlanType.FREE, status: PlanStatus.PUBLISHED },
  })
  if (!plan) throw new FreeTrialError("FREE_PLAN_UNAVAILABLE", "No published FREE plan is configured")

  const version = plan.currentVersionId
    ? await db.planVersion.findUnique({ where: { id: plan.currentVersionId } })
    : await db.planVersion.findFirst({
        where: { planId: plan.id, status: PlanVersionStatus.PUBLISHED },
        orderBy: { version: "desc" },
      })
  if (!version || version.status !== PlanVersionStatus.PUBLISHED) {
    throw new FreeTrialError("FREE_PLAN_UNAVAILABLE", "Published FREE plan has no published version")
  }

  const environment = currentSubscriptionEnvironment()
  const dedupeKey = buildFreeEnrollmentKey(userId, version.id)

  const existing = await db.freeEnrollment.findUnique({ where: { dedupeKey } })
  if (existing && existing.status === FreeEnrollmentStatus.ACTIVE) {
    return {
      enrollmentId: existing.id,
      planId: plan.id,
      planVersionId: version.id,
      grantCount: 0,
      existing: true,
    }
  }

  let enrollment
  if (existing) {
    enrollment = await db.freeEnrollment.update({
      where: { id: existing.id },
      data: { status: FreeEnrollmentStatus.ACTIVE },
    })
  } else {
    try {
      enrollment = await db.freeEnrollment.create({
        data: { userId, planId: plan.id, planVersionId: version.id, status: FreeEnrollmentStatus.ACTIVE, environment, dedupeKey },
      })
    } catch (err) {
      if (err instanceof Error && /Unique constraint/i.test(err.message)) {
        const concurrent = await db.freeEnrollment.findUnique({ where: { dedupeKey } })
        if (concurrent) {
          return { enrollmentId: concurrent.id, planId: plan.id, planVersionId: version.id, grantCount: 0, existing: true }
        }
      }
      throw new FreeTrialError("TRIAL_PROVISIONING_FAILED", "Could not create free enrollment")
    }
  }

  const grantCount = await provisionPlanGrants({
    userId,
    planVersionId: version.id,
    sourceType: EntitlementSourceType.FREE_PLAN,
    sourceReference: enrollment.id,
    expiresAt: null, // Free Forever has no automatic expiration
    actorId,
  })

  await emitEvent({
    type: EVENTS.FREE_ENROLLED,
    timestamp: new Date().toISOString(),
    actorId,
    payload: { enrollmentId: enrollment.id, planVersionId: version.id, grantCount },
  }).catch(() => undefined)

  return { enrollmentId: enrollment.id, planId: plan.id, planVersionId: version.id, grantCount, existing: false }
}

// ── Trial ─────────────────────────────────────────────────────────────────────

export interface StartTrialInput {
  userId: string
  planId: string
}

export interface TrialResult {
  enrollmentId: string
  planId: string
  planVersionId: string
  status: TrialStatus
  startedAt: Date
  expiresAt: Date
  grantCount: number
  existing: boolean
}

/**
 * Starts (or returns) a 14-day trial for an eligible customer. One trial per
 * customer per plan version (scope-key unique). Server-derived timing only.
 */
export async function startTrial(input: StartTrialInput, actorId: string = "system"): Promise<TrialResult> {
  if (!input.userId) throw new FreeTrialError("TRIAL_NOT_ELIGIBLE", "An authenticated customer is required")

  const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true, isBanned: true, isVerified: true } })
  if (!user || user.isBanned) throw new FreeTrialError("TRIAL_NOT_ELIGIBLE", "Unknown or banned customer")

  const plan = await db.subscriptionPlan.findUnique({
    where: { id: input.planId },
    include: { versions: { orderBy: { version: "desc" } } },
  })
  if (!plan) throw new FreeTrialError("INVALID_PLAN_VERSION", "Unknown plan")
  if (!isBillablePlanType(plan.planType)) {
    throw new FreeTrialError("TRIAL_NOT_ELIGIBLE", "FREE plans cannot be trial eligibility sources")
  }
  if (plan.status !== PlanStatus.PUBLISHED) {
    throw new FreeTrialError("TRIAL_NOT_ELIGIBLE", "Plan is not published")
  }
  const version = plan.currentVersionId
    ? plan.versions.find((v) => v.id === plan.currentVersionId) ?? plan.versions[0]
    : plan.versions[0]
  if (!version || version.status !== PlanVersionStatus.PUBLISHED) {
    throw new FreeTrialError("INVALID_PLAN_VERSION", "Plan has no published version")
  }

  const scopeKey = buildTrialScopeKey(input.userId, version.id)

  // Eligibility (server-side, deterministic).
  const [trials, paid] = await Promise.all([
    db.trialEnrollment.findMany({ where: { userId: input.userId, trialScopeKey: scopeKey }, orderBy: { createdAt: "desc" } }),
    db.userSubscription.findFirst({
      where: { userId: input.userId, status: { in: ["TRIALING", "ACTIVE", "UNPAID", "PAST_DUE", "PAUSED"] } },
    }),
  ])
  const pending = trials.find((t) => t.status === "PENDING")
  if (pending) {
    // Retry provisioning of a pending enrollment (no double enrollment).
    const grantCount = await provisionPlanGrants({
      userId: input.userId,
      planVersionId: version.id,
      sourceType: EntitlementSourceType.TRIAL,
      sourceReference: pending.id,
      expiresAt: pending.expiresAt,
      actorId,
    })
    return {
      enrollmentId: pending.id,
      planId: plan.id,
      planVersionId: version.id,
      status: TrialStatus.ACTIVE,
      startedAt: pending.startedAt as Date,
      expiresAt: pending.expiresAt as Date,
      grantCount,
      existing: true,
    }
  }
  const latest = trials[0]
  const eligibility = evaluateTrialEligibility({
    hasVerifiedAccount: user.isVerified,
    hasActiveOrPendingTrial: trials.some((t) => t.status === "PENDING" || t.status === "ACTIVE"),
    hasConsumedTrial:
      !!latest && ["EXPIRED", "CANCELLED", "CONVERTED"].includes(latest.status),
    hasActivePaidSubscription: !!paid,
  })
  if (!eligibility.eligible) {
    throw new FreeTrialError(
      eligibility.code as never,
      eligibility.code === "TRIAL_ALREADY_ACTIVE"
        ? "Trial already active for this scope"
        : "Customer is not eligible for a trial",
    )
  }

  const environment = currentSubscriptionEnvironment()
  const startedAt = new Date()
  const expiresAt = trialExpiresAtFor(startedAt)

  let trial
  try {
    trial = await db.trialEnrollment.create({
      data: {
        userId: input.userId,
        planId: plan.id,
        planVersionId: version.id,
        trialScopeKey: scopeKey,
        status: TrialStatus.PENDING,
        startedAt,
        expiresAt,
        environment,
        metadata: { source: "TRIAL", pendingProvisioning: true },
      },
    })
  } catch (err) {
    if (err instanceof Error && /Unique constraint/i.test(err.message)) {
      throw new FreeTrialError("TRIAL_ALREADY_ACTIVE", "A trial for this scope already exists")
    }
    throw new FreeTrialError("TRIAL_PROVISIONING_FAILED", "Could not create trial enrollment")
  }

  try {
    const grantCount = await provisionPlanGrants({
      userId: input.userId,
      planVersionId: version.id,
      sourceType: EntitlementSourceType.TRIAL,
      sourceReference: trial.id,
      expiresAt,
      actorId,
    })
    const activated = await db.trialEnrollment.update({
      where: { id: trial.id },
      data: { status: TrialStatus.ACTIVE, metadata: { pendingProvisioning: false } },
    })
    await emitEvent({
      type: EVENTS.TRIAL_ACTIVATED,
      timestamp: new Date().toISOString(),
      actorId,
      payload: { trialId: trial.id, grantCount },
    }).catch(() => undefined)
    return {
      enrollmentId: trial.id,
      planId: plan.id,
      planVersionId: version.id,
      status: activated.status,
      startedAt,
      expiresAt,
      grantCount,
      existing: false,
    }
  } catch (err) {
    // Never report false successful activation; keep PENDING for safe retry.
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500)
    await db.trialEnrollment.update({
      where: { id: trial.id },
      data: { provisioningError: message },
    }).catch(() => undefined)
    logger.warn({ trialId: trial.id, err }, "trial provisioning failed")
    throw new FreeTrialError("TRIAL_PROVISIONING_FAILED", `Trial provisioning failed: ${message}`)
  }
}

// ── Expiration / cancellation / conversion ────────────────────────────────────

async function expireTrialGrants(userId: string, trialId: string, actorId: string): Promise<number> {
  const rows = await db.entitlementGrant.findMany({
    where: {
      sourceType: EntitlementSourceType.TRIAL,
      sourceReference: trialId,
    },
  })
  let expired = 0
  for (const g of rows) {
    if ((g as { status?: string }).status !== "ACTIVE") continue
    if (g.subjectUserId !== userId) continue
    await expireEntitlementGrant(g.id, actorId, "TRIAL_ENDED")
    expired += 1
  }
  return expired
}

/**
 * Expires ACTIVE trials whose boundary has passed. Access is ALREADY denied by
 * the resolver (grant expiresAt + trial expiry rule); this is cleanup only.
 */
export async function expireExpiredTrials(now: Date = new Date(), actorId: string = "system"): Promise<{ expired: number }> {
  const due = await db.trialEnrollment.findMany({
    where: { status: TrialStatus.ACTIVE, expiresAt: { lte: now } },
    select: { id: true, userId: true },
  })
  let expired = 0
  for (const t of due) {
    const grantsExpired = await expireTrialGrants(t.userId, t.id, actorId)
    await db.trialEnrollment.update({
      where: { id: t.id },
      data: { status: TrialStatus.EXPIRED, metadata: { expiredAt: now.toISOString(), grantsExpired } },
    })
    await emitEvent({
      type: EVENTS.TRIAL_EXPIRED,
      timestamp: new Date().toISOString(),
      actorId,
      payload: { trialId: t.id, grantsExpired },
    }).catch(() => undefined)
    expired += 1
  }
  return { expired }
}

export async function cancelTrial(trialId: string, userId: string, actorId: string = "system") {
  const trial = await db.trialEnrollment.findUnique({ where: { id: trialId } })
  if (!trial) throw new FreeTrialError("TRIAL_STATE_CONFLICT", "Unknown trial")
  if (trial.userId !== userId) throw new FreeTrialError("TRIAL_STATE_CONFLICT", "Trial belongs to another customer")
  if (trial.status === "ACTIVE" || trial.status === "PENDING") {
    await expireTrialGrants(userId, trial.id, actorId)
    await db.trialEnrollment.update({
      where: { id: trial.id },
      data: { status: TrialStatus.CANCELLED, cancelledAt: new Date() },
    })
  }
  return { status: TrialStatus.CANCELLED }
}

/**
 * Marks a trial CONVERTED ONLY after authoritative paid confirmation:
 * an ACTIVE paid subscription bound to the SAME plan version exists, and paid
 * (SUBSCRIPTION-source) grants were provisioned. Paid access stays intact;
 * trial grants are retired afterwards (no access gap).
 */
export async function confirmTrialConversion(trialId: string, actorId: string = "system") {
  const trial = await db.trialEnrollment.findUnique({ where: { id: trialId } })
  if (!trial) throw new FreeTrialError("TRIAL_STATE_CONFLICT", "Unknown trial")
  if (trial.status === "CONVERTED") return { status: TrialStatus.CONVERTED, duplicate: true }
  if (trial.status === "EXPIRED" || trial.status === "CANCELLED") {
    throw new FreeTrialError("PAID_CONVERSION_NOT_CONFIRMED", `Trial is ${trial.status}`)
  }

  // Authoritative paid state (Phase 4 record, ACTIVE) for the same plan version.
  const paid = await db.userSubscription.findFirst({
    where: { userId: trial.userId, planVersionId: trial.planVersionId, status: "ACTIVE" },
  })
  if (!paid) {
    throw new FreeTrialError(
      "PAID_CONVERSION_NOT_CONFIRMED",
      "No verified ACTIVE paid subscription for this plan version",
    )
  }

  // Paid grants must already exist (Phase 5) before the trial grant is removed.
  const paidGrants = await db.entitlementGrant.findMany({
    where: {
      sourceType: EntitlementSourceType.SUBSCRIPTION,
      sourceReference: paid.id,
    },
  })
  const paidGrant = paidGrants.find(
    (g) =>
      g.subjectUserId === trial.userId &&
      (g as { status?: string }).status === "ACTIVE",
  )
  if (!paidGrant) {
    throw new FreeTrialError(
      "PAID_CONVERSION_PENDING",
      "Paid entitlements not provisioned yet; conversion not confirmed",
    )
  }

  await expireTrialGrants(trial.userId, trial.id, actorId)
  await db.trialEnrollment.update({
    where: { id: trial.id },
    data: { status: TrialStatus.CONVERTED, convertedAt: new Date() },
  })
  await emitEvent({
    type: EVENTS.TRIAL_CONVERTED,
    timestamp: new Date().toISOString(),
    actorId,
    payload: { trialId: trial.id, converted: true },
  }).catch(() => undefined)
  return { status: TrialStatus.CONVERTED, duplicate: false }
}

// ── Worker hook (reuse existing sweep infra) ─────────────────────────────────

export async function scheduleTrialExpiry(): Promise<void> {
  try {
    await subscriptionQueue.add(SUBSCRIPTION_JOBS.TRIAL_EXPIRE, {}, {
      jobId: "trial-expiry-15m",
      repeat: { pattern: "*/15 * * * *" },
    })
  } catch {
    // lazy queue unavailable in dev/test — the read-time rule still denies.
  }
}
