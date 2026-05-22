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
import { SubStatus } from "@prisma/client"

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

  const result = await db.$transaction(async (tx) => {
    // 1. Update subscription
    const subscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        tierId: newTierId,
        updatedAt: new Date(),
      },
      include: { tier: true, user: true, product: true },
    })

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

  return { success: true }
}

// ── Reactivate Subscription ────────────────────────────────────────────────────

export async function reactivateSubscription(
  subscriptionId: string,
  adminId: string
): Promise<{ success: boolean }> {
  const current = await db.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
  })

  const newPeriodEnd = new Date()
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

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

  return { success: true }
}
