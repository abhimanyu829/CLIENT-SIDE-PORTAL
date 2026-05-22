import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/admin-audit"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()
  const body = await req.json()
  const { action, reason, extendDays, newTierId } = body

  const sub = await db.subscription.findUnique({
    where: { id: id },
    include: { tier: true, product: true },
  })
  if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 })

  switch (action) {
    case "cancel": {
      await auditLog({
        userId: admin.userId,
        action: "SUBSCRIPTION_CANCELLED",
        entity: "Subscription",
        entityId: id,
        before: { status: sub.status },
        after: { status: "CANCELLED", reason },
      })
      await db.subscription.update({
        where: { id: id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      })
      return NextResponse.json({ success: true, message: "Subscription cancelled" })
    }

    case "pause": {
      await auditLog({
        userId: admin.userId,
        action: "SUBSCRIPTION_PAUSED",
        entity: "Subscription",
        entityId: id,
        before: { status: sub.status },
        after: { status: "PAUSED", reason },
      })
      await db.subscription.update({
        where: { id: id },
        data: { status: "PAUSED" },
      })
      return NextResponse.json({ success: true, message: "Subscription paused" })
    }

    case "resume": {
      await auditLog({
        userId: admin.userId,
        action: "SUBSCRIPTION_RESUMED",
        entity: "Subscription",
        entityId: id,
        before: { status: sub.status },
        after: { status: "ACTIVE", reason },
      })
      await db.subscription.update({
        where: { id: id },
        data: { status: "ACTIVE" },
      })
      return NextResponse.json({ success: true, message: "Subscription resumed" })
    }

    case "extend-trial": {
      if (!extendDays || extendDays <= 0) {
        return NextResponse.json({ error: "Invalid extend days" }, { status: 400 })
      }
      const oldTrialEnd = sub.trialEndsAt || new Date()
      const newTrialEnd = new Date(oldTrialEnd.getTime() + extendDays * 24 * 60 * 60 * 1000)

      await auditLog({
        userId: admin.userId,
        action: "SUBSCRIPTION_TRIAL_EXTENDED",
        entity: "Subscription",
        entityId: id,
        before: { trialEndsAt: sub.trialEndsAt },
        after: { trialEndsAt: newTrialEnd, extendDays, reason },
      })
      await db.subscription.update({
        where: { id: id },
        data: { trialEndsAt: newTrialEnd },
      })
      return NextResponse.json({ success: true, message: "Trial extended" })
    }

    case "migrate-plan": {
      if (!newTierId) return NextResponse.json({ error: "newTierId is required" }, { status: 400 })
      const tier = await db.productTier.findUnique({ where: { id: newTierId } })
      if (!tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 })

      await auditLog({
        userId: admin.userId,
        action: "SUBSCRIPTION_MIGRATED",
        entity: "Subscription",
        entityId: id,
        before: { tierId: sub.tierId, productId: sub.productId },
        after: { tierId: newTierId, productId: tier.productId, reason },
      })
      await db.subscription.update({
        where: { id: id },
        data: { tierId: newTierId, productId: tier.productId },
      })
      return NextResponse.json({ success: true, message: "Plan migrated successfully" })
    }

    case "override-renewal-date": {
      const { newRenewalDate } = body
      if (!newRenewalDate) return NextResponse.json({ error: "newRenewalDate is required" }, { status: 400 })
      const newEnd = new Date(newRenewalDate)

      await auditLog({
        userId: admin.userId,
        action: "SUBSCRIPTION_RENEWAL_DATE_OVERRIDDEN",
        entity: "Subscription",
        entityId: id,
        before: { currentPeriodEnd: sub.currentPeriodEnd },
        after: { currentPeriodEnd: newEnd, reason },
      })
      await db.subscription.update({
        where: { id: id },
        data: { currentPeriodEnd: newEnd },
      })
      return NextResponse.json({ success: true, message: "Renewal date overridden" })
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
}
