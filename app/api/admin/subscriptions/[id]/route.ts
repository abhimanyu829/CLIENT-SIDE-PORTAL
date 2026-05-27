import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/admin-audit"
import { cancelSubscription, changePlan, pauseSubscription, reactivateSubscription, syncSubscriptionAccessState } from "@/lib/services/subscription-service"

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
      await cancelSubscription(id, admin.userId, reason ?? "Admin cancellation")
      return NextResponse.json({ success: true, message: "Subscription cancelled" })
    }

    case "pause": {
      await pauseSubscription(id, admin.userId, reason ?? "Admin pause")
      return NextResponse.json({ success: true, message: "Subscription paused" })
    }

    case "resume": {
      await reactivateSubscription(id, admin.userId)
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
      await syncSubscriptionAccessState(id)
      return NextResponse.json({ success: true, message: "Trial extended" })
    }

    case "migrate-plan": {
      if (!newTierId) return NextResponse.json({ error: "newTierId is required" }, { status: 400 })
      await changePlan(id, newTierId, admin.userId, reason ?? "Admin plan migration")
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
      await syncSubscriptionAccessState(id)
      return NextResponse.json({ success: true, message: "Renewal date overridden" })
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
}
