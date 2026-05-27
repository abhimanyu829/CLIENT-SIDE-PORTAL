/**
 * lib/services/subscription-service.ts
 *
 * Centralized subscription operations — ALL critical mutations use prisma.$transaction().
 * This is the SINGLE source of truth for subscription lifecycle management.
 * No other module should directly mutate subscription state.
 */

import { db } from "@/lib/db"
import { auditLog } from "@/lib/admin-audit"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { redis } from "@/lib/redis"
import { aiQuotaCacheKey } from "@/lib/services/cache-service"
import { BillingInterval, Prisma, SubStatus } from "@prisma/client"

function periodEndFor(interval: BillingInterval, from = new Date()) {
  const end = new Date(from)
  if (interval === BillingInterval.YEARLY) end.setFullYear(end.getFullYear() + 1)
  else if (interval === BillingInterval.WEEKLY) end.setDate(end.getDate() + 7)
  else if (interval === BillingInterval.ONE_TIME || interval === BillingInterval.LIFETIME) end.setFullYear(end.getFullYear() + 100)
  else end.setMonth(end.getMonth() + 1)
  return end
}

async function clearUserAccessCaches(userId: string) {
  if (!redis) return
  try {
    await Promise.all([
      redis.del(`${aiQuotaCacheKey(userId)}:daily`),
      redis.del(`access:user:${userId}`),
    ])
  } catch {
    // cache invalidation is non-fatal
  }
}

async function syncEntitlementForSubscription(tx: Prisma.TransactionClient, subscriptionId: string) {
  const subscription = await tx.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { tier: true },
  })

  const accessActive =
    (subscription.status === SubStatus.ACTIVE || subscription.status === SubStatus.TRIALING) &&
    subscription.currentPeriodEnd > new Date()

  const existing = await tx.customerEntitlement.findFirst({
    where: { userId: subscription.userId, productId: subscription.productId, subscriptionId: subscription.id },
  })

  if (accessActive) {
    if (existing) {
      await tx.customerEntitlement.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          accessType: subscription.tier.fulfillmentType,
          quota: subscription.tier.aiQuota ?? {},
          expiresAt: subscription.currentPeriodEnd,
          metadata: {
            subscriptionId: subscription.id,
            tierId: subscription.tierId,
            planName: subscription.tier.name,
            syncedAt: new Date().toISOString(),
          },
        },
      })
    } else {
      await tx.customerEntitlement.create({
        data: {
          userId: subscription.userId,
          productId: subscription.productId,
          subscriptionId: subscription.id,
          status: "ACTIVE",
          accessType: subscription.tier.fulfillmentType,
          quota: subscription.tier.aiQuota ?? {},
          expiresAt: subscription.currentPeriodEnd,
          metadata: {
            subscriptionId: subscription.id,
            tierId: subscription.tierId,
            planName: subscription.tier.name,
            syncedAt: new Date().toISOString(),
          },
        },
      })
    }
    return
  }

  if (existing) {
    await tx.customerEntitlement.update({
      where: { id: existing.id },
      data: {
        status: subscription.status === SubStatus.PAUSED ? "PAUSED" : "REVOKED",
        expiresAt: new Date(),
        metadata: {
          ...((existing.metadata as Record<string, unknown>) ?? {}),
          revokedBySubscriptionStatus: subscription.status,
          syncedAt: new Date().toISOString(),
        },
      },
    })
  }
}

// ── Plan Change ───────────────────────────────────────────────────────────────

/**
 * Atomically changes a subscription's plan tier.
 * Records pricing history, updates entitlements, emits PLAN_CHANGED event.
 */
export async function changePlan(
  subscriptionId: string,
  newTierId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; subscription: object }> {
  // Load current state before transaction
  const current = await db.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { tier: true, user: true, product: true },
  })

  const newTier = await db.productTier.findUniqueOrThrow({
    where: { id: newTierId },
  })
  if (!newTier.isActive) throw new Error("Target tier is inactive")

  const result = await db.$transaction(async (tx) => {
    // 1. Update subscription
    const subscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        tierId: newTierId,
        productId: newTier.productId,
        status: SubStatus.ACTIVE,
        updatedAt: new Date(),
      },
      include: { tier: true, user: true, product: true },
    })
    await syncEntitlementForSubscription(tx, subscriptionId)

    // 2. Record pricing history if price changed
    if (Number(current.tier.price) !== Number(newTier.price)) {
      await tx.pricingHistory.create({
        data: {
          tierId: current.tierId,
          productId: current.productId,
          oldPrice: current.tier.price,
          newPrice: newTier.price,
          currency: newTier.currency,
          interval: newTier.interval,
          changedBy: adminId,
          reason,
          effectiveAt: new Date(),
        },
      })
    }

    // 3. Write audit log inside transaction
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "PLAN_CHANGED",
        entity: "Subscription",
        entityId: subscriptionId,
        beforeJson: {
          tierId: current.tierId,
          tierName: current.tier.name,
          price: String(current.tier.price),
        },
        afterJson: {
          tierId: newTierId,
          tierName: newTier.name,
          price: String(newTier.price),
          reason,
        },
      },
    })

    return subscription
  })

  // 4. Emit event (non-transactional, non-blocking)
  await emitEvent({
    type: EVENTS.PLAN_CHANGED,
    timestamp: new Date().toISOString(),
    actorId: adminId,
    payload: {
      subscriptionId,
      userId: current.userId,
      oldTierId: current.tierId,
      newTierId,
      reason,
    },
  })
  await clearUserAccessCaches(current.userId)

  return { success: true, subscription: result }
}

// ── Cancel Subscription ────────────────────────────────────────────────────────

export async function cancelSubscription(
  subscriptionId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean }> {
  const current = await db.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
  })

  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      },
    })
    await syncEntitlementForSubscription(tx, subscriptionId)

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "SUBSCRIPTION_CANCELLED_BY_ADMIN",
        entity: "Subscription",
        entityId: subscriptionId,
        beforeJson: { status: current.status },
        afterJson: { status: "CANCELLED", reason, adminId },
      },
    })
  })

  await emitEvent({
    type: EVENTS.SUBSCRIPTION_CANCELLED,
    timestamp: new Date().toISOString(),
    actorId: adminId,
    payload: { subscriptionId, userId: current.userId, reason },
  })
  await clearUserAccessCaches(current.userId)

  return { success: true }
}

// ── Reactivate Subscription ────────────────────────────────────────────────────

export async function reactivateSubscription(
  subscriptionId: string,
  adminId: string
): Promise<{ success: boolean }> {
  const current = await db.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { tier: true },
  })

  const newPeriodEnd = periodEndFor(current.tier.interval)

  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubStatus.ACTIVE,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(),
        currentPeriodEnd: newPeriodEnd,
        updatedAt: new Date(),
      },
    })
    await syncEntitlementForSubscription(tx, subscriptionId)

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "SUBSCRIPTION_REACTIVATED_BY_ADMIN",
        entity: "Subscription",
        entityId: subscriptionId,
        beforeJson: { status: current.status },
        afterJson: { status: "ACTIVE", adminId },
      },
    })
  })

  await emitEvent({
    type: EVENTS.SUBSCRIPTION_REACTIVATED,
    timestamp: new Date().toISOString(),
    actorId: adminId,
    payload: { subscriptionId, userId: current.userId },
  })
  await clearUserAccessCaches(current.userId)

  return { success: true }
}

// ── Pause Subscription ─────────────────────────────────────────────────────────

export async function pauseSubscription(
  subscriptionId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean }> {
  const current = await db.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
  })

  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubStatus.PAUSED, updatedAt: new Date() },
    })
    await syncEntitlementForSubscription(tx, subscriptionId)

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "SUBSCRIPTION_PAUSED_BY_ADMIN",
        entity: "Subscription",
        entityId: subscriptionId,
        beforeJson: { status: current.status },
        afterJson: { status: "PAUSED", reason },
      },
    })
  })

  await emitEvent({
    type: EVENTS.SUBSCRIPTION_PAUSED,
    timestamp: new Date().toISOString(),
    actorId: adminId,
    payload: { subscriptionId, userId: current.userId, reason },
  })
  await clearUserAccessCaches(current.userId)

  return { success: true }
}

export async function markSubscriptionPastDue(
  subscriptionId: string,
  actorId: string,
  reason: string
): Promise<{ success: boolean }> {
  const current = await db.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
  })

  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubStatus.PAST_DUE, updatedAt: new Date() },
    })
    await syncEntitlementForSubscription(tx, subscriptionId)
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "SUBSCRIPTION_MARKED_PAST_DUE",
        entity: "Subscription",
        entityId: subscriptionId,
        beforeJson: { status: current.status },
        afterJson: { status: "PAST_DUE", reason },
      },
    })
  })

  await emitEvent({
    type: EVENTS.PAYMENT_FAILED,
    timestamp: new Date().toISOString(),
    actorId,
    payload: { subscriptionId, userId: current.userId, reason },
  })
  await clearUserAccessCaches(current.userId)

  return { success: true }
}

export async function revokeUserAccessForOrder(
  orderId: string,
  actorId: string,
  reason: string
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return

  await db.$transaction(async (tx) => {
    await tx.customerEntitlement.updateMany({
      where: { orderId },
      data: {
        status: "REVOKED",
        expiresAt: new Date(),
      },
    })

    const subscriptionIds = await tx.customerEntitlement.findMany({
      where: { orderId, subscriptionId: { not: null } },
      select: { subscriptionId: true },
    })
    for (const entry of subscriptionIds) {
      if (!entry.subscriptionId) continue
      await tx.subscription.update({
        where: { id: entry.subscriptionId },
        data: { status: SubStatus.CANCELLED, cancelledAt: new Date(), cancelAtPeriodEnd: false },
      })
      await syncEntitlementForSubscription(tx, entry.subscriptionId)
    }

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "ORDER_ACCESS_REVOKED",
        entity: "Order",
        entityId: orderId,
        afterJson: { reason, userId: order.userId },
      },
    })
  })

  await clearUserAccessCaches(order.userId)
  await emitEvent({
    type: EVENTS.SUBSCRIPTION_CANCELLED,
    timestamp: new Date().toISOString(),
    actorId,
    payload: { orderId, userId: order.userId, reason },
  })
}

export async function expireOverdueSubscriptions(now = new Date()): Promise<{ expired: number }> {
  const overdue = await db.subscription.findMany({
    where: {
      status: { in: [SubStatus.ACTIVE, SubStatus.TRIALING, SubStatus.PAST_DUE] },
      currentPeriodEnd: { lt: now },
    },
    select: { id: true, userId: true, status: true },
  })

  for (const sub of overdue) {
    await db.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubStatus.CANCELLED,
          cancelledAt: now,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        },
      })
      await syncEntitlementForSubscription(tx, sub.id)
      await tx.auditLog.create({
        data: {
          userId: sub.userId,
          action: "SUBSCRIPTION_AUTO_EXPIRED",
          entity: "Subscription",
          entityId: sub.id,
          beforeJson: { status: sub.status },
          afterJson: { status: "CANCELLED", expiredAt: now.toISOString() },
        },
      })
    })
    await clearUserAccessCaches(sub.userId)
    await emitEvent({
      type: EVENTS.SUBSCRIPTION_CANCELLED,
      timestamp: now.toISOString(),
      actorId: sub.userId,
      payload: { subscriptionId: sub.id, userId: sub.userId, reason: "period_expired" },
    })
  }

  return { expired: overdue.length }
}

export async function syncSubscriptionAccessState(subscriptionId: string): Promise<void> {
  const sub = await db.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    select: { userId: true },
  })
  await db.$transaction(async (tx) => {
    await syncEntitlementForSubscription(tx, subscriptionId)
  })
  await clearUserAccessCaches(sub.userId)
}

export async function userHasProductAccess(userId: string, productId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isBanned: true, isVerified: true } })
  if (!user || user.isBanned || !user.isVerified) return false

  const entitlement = await db.customerEntitlement.findFirst({
    where: {
      userId,
      productId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  })
  return Boolean(entitlement)
}
