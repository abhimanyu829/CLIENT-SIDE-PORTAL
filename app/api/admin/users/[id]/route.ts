import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/admin-audit"
import { changePlan } from "@/lib/services/subscription-service"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()
  const body = await req.json()
  const { action, reason, couponCode, newTierId, newRole } = body

  const user = await db.user.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  switch (action) {
    case "block": {
      // Delegate to the dedicated ban route for full transactional safety
      return NextResponse.json({
        message: "Use POST /api/admin/users/:id/ban with action='ban' for banning",
      }, { status: 301 })
    }

    case "flag": {
      await db.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: admin.userId,
            action: "USER_FLAGGED_FRAUD",
            entity: "User",
            entityId: id,
            afterJson: { reason, flaggedBy: admin.userId },
          },
        })
      })

      await emitEvent({
        type: EVENTS.FRAUD_FLAGGED,
        timestamp: new Date().toISOString(),
        actorId: admin.userId,
        payload: { userId: id, email: user.email, reason },
      })

      return NextResponse.json({ success: true, message: "User flagged for fraud review" })
    }

    case "change-role": {
      if (!admin.isSuperAdmin) {
        return NextResponse.json({ error: "Only SUPER_ADMIN can change user roles" }, { status: 403 })
      }
      if (!newRole || !["CLIENT", "SUB_ADMIN", "SUPER_ADMIN", "GUEST"].includes(newRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 })
      }

      await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { role: newRole } })
        // Invalidate all sessions on role change for security
        await tx.userSession.deleteMany({ where: { userId: id } })
        await tx.auditLog.create({
          data: {
            userId: admin.userId,
            action: "USER_ROLE_CHANGED",
            entity: "User",
            entityId: id,
            beforeJson: { role: user.role },
            afterJson: { role: newRole, reason: reason ?? null, adminId: admin.userId },
          },
        })
      })

      await emitEvent({
        type: EVENTS.USER_ROLE_CHANGED,
        timestamp: new Date().toISOString(),
        actorId: admin.userId,
        payload: { userId: id, oldRole: user.role, newRole, reason },
      })

      return NextResponse.json({ success: true, message: `User role changed to ${newRole}` })
    }

    case "impersonate": {
      if (!admin.isSuperAdmin) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }
      await auditLog({
        userId: admin.userId,
        action: "USER_IMPERSONATED",
        entity: "User",
        entityId: id,
        after: { impersonatedBy: admin.userId, reason },
      })
      return NextResponse.json({ success: true, message: "Impersonation session created" })
    }

    case "issue-coupon": {
      const coupon = await db.coupon.findUnique({ where: { code: couponCode } })
      if (!coupon) return NextResponse.json({ error: "Coupon not found" }, { status: 404 })

      await db.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: admin.userId,
            action: "COUPON_ISSUED_TO_USER",
            entity: "User",
            entityId: id,
            afterJson: { couponCode, issuedBy: admin.userId, couponId: coupon.id },
          },
        })
      })

      return NextResponse.json({ success: true, message: "Coupon issued to user" })
    }

    case "gdpr-delete": {
      if (!admin.isSuperAdmin) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      await db.$transaction(async (tx) => {
        // Anonymize user data per GDPR
        await tx.user.update({
          where: { id },
          data: {
            name: "[Deleted]",
            email: `deleted+${id}@gdpr.removed`,
            phone: null,
            avatarUrl: null,
            passwordHash: null,
            twoFactorSecret: null,
            isBanned: true,
            banReason: "GDPR deletion",
          },
        })
        // Invalidate sessions
        await tx.userSession.deleteMany({ where: { userId: id } })
        // Audit
        await tx.auditLog.create({
          data: {
            userId: admin.userId,
            action: "USER_GDPR_DELETED",
            entity: "User",
            entityId: id,
            beforeJson: { email: user.email, name: user.name },
            afterJson: { reason, deletedBy: admin.userId },
          },
        })
      })

      return NextResponse.json({ success: true, message: "User data deleted per GDPR" })
    }

    case "upgrade-plan": {
      if (!newTierId) return NextResponse.json({ error: "newTierId required" }, { status: 400 })
      if (!reason) return NextResponse.json({ error: "reason required" }, { status: 400 })

      const sub = await db.subscription.findFirst({
        where: { userId: id, status: "ACTIVE" },
      })
      if (!sub) return NextResponse.json({ error: "No active subscription" }, { status: 404 })

      const result = await changePlan(sub.id, newTierId, admin.userId, reason)
      return NextResponse.json(result)
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
}
