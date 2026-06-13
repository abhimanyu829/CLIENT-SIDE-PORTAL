import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { processRefund } from "@/lib/services/refund-service"
import { logger } from "@/lib/logger"

/**
 * POST /api/refunds/request
 *
 * Allows a buyer to request a refund within the 3-hour window.
 * Auto-triggers the gateway refund, suspends entitlement, and notifies admin.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const userId = session.user.id
  let body: { entitlementId?: string; reason?: string; refundReasonCategory?: string; partialAmount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { entitlementId, reason, refundReasonCategory, partialAmount } = body

  // Validate reason category
  const validCategories = ["BUG", "NOT_AS_DESCRIBED", "ACCIDENTAL", "NO_LONGER_NEEDED", "OTHER"]
  const category = validCategories.includes(refundReasonCategory ?? "") ? refundReasonCategory : "OTHER"

  if (!entitlementId) {
    return NextResponse.json({ error: "entitlementId is required" }, { status: 400 })
  }
  if (!reason || reason.trim().length < 10) {
    return NextResponse.json(
      { error: "Please provide a detailed reason (minimum 10 characters)" },
      { status: 400 }
    )
  }

  // Fetch entitlement with ownership check
  const entitlement = await db.customerEntitlement.findUnique({
    where: { id: entitlementId },
    include: {
      product: { select: { name: true, slug: true } },
    },
  })

  if (!entitlement) {
    return NextResponse.json({ error: "Entitlement not found" }, { status: 404 })
  }

  if (entitlement.userId !== userId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  // Check refund eligibility window
  if (!entitlement.refundEligibleUntil || entitlement.refundEligibleUntil < new Date()) {
    const closedAt = entitlement.refundEligibleUntil
      ? new Date(entitlement.refundEligibleUntil).toLocaleString()
      : "immediately after purchase"
    return NextResponse.json(
      {
        error: `Refund window has closed. Refunds are only available within 3 hours of purchase. Window closed at ${closedAt}.`,
        windowClosed: true,
      },
      { status: 403 }
    )
  }

  // Prevent duplicate refund requests
  if (entitlement.refundRequested) {
    return NextResponse.json(
      { error: "A refund has already been requested for this entitlement." },
      { status: 409 }
    )
  }

  // Fetch the associated payment for this order
  const order = entitlement.orderId
    ? await db.order.findUnique({
        where: { id: entitlement.orderId },
        include: { payments: { where: { status: "SUCCESS" }, take: 1 } },
      })
    : null

  const payment = order?.payments?.[0]
  const fullRefundAmount = payment?.amount ? Number(payment.amount) : 0

  // Validate partial refund amount
  let refundAmount = fullRefundAmount
  if (partialAmount && partialAmount > 0 && partialAmount < fullRefundAmount) {
    refundAmount = partialAmount
  } else if (partialAmount && partialAmount >= fullRefundAmount) {
    // If partial amount >= full amount, just do full refund
    refundAmount = fullRefundAmount
  }

  const isPartialRefund = refundAmount < fullRefundAmount

  // Create refund request + suspend entitlement atomically
  const refundRequest = await db.$transaction(async (tx) => {
    const rr = await tx.refundRequest.create({
      data: {
        userId,
        paymentId: payment?.id ?? "manual",
        orderId: entitlement.orderId ?? undefined,
        entitlementId,
        reason: reason.trim(),
        status: "PENDING",
        gateway: payment?.gateway?.toString(),
        refundAmount: refundAmount,
        auditTrail: [
          {
            action: "REQUESTED",
            by: userId,
            at: new Date().toISOString(),
            reason: reason.trim(),
            category,
            isPartialRefund,
            refundAmount,
            fullRefundAmount,
          },
        ],
      },
    })

    await tx.customerEntitlement.update({
      where: { id: entitlementId },
      data: {
        refundRequested: true,
        refundRequestedAt: new Date(),
        refundRequestReason: reason.trim(),
        status: "SUSPENDED",
        accessRevokedAt: new Date(),
        revocationReason: "Refund requested",
      },
    })

    await tx.auditLog.create({
      data: {
        userId,
        action: "REFUND_REQUESTED",
        entity: "RefundRequest",
        entityId: rr.id,
        afterJson: {
          entitlementId,
          productName: entitlement.product.name,
          reason: reason.trim(),
          refundAmount,
          paymentId: payment?.id,
        },
      },
    })

    return rr
  })

  // Attempt auto-refund via gateway
  let gatewayRefundId: string | undefined
  if (payment?.id) {
    try {
      const refundResult = await processRefund(
        payment.id,
        refundAmount,
        `${reason.trim()}${isPartialRefund ? ` (Partial: ${refundAmount}/${fullRefundAmount})` : ""}`,
        "SYSTEM"
      )
      if (refundResult?.gatewayRefundId) {
        gatewayRefundId = refundResult.gatewayRefundId
        await db.refundRequest.update({
          where: { id: refundRequest.id },
          data: {
            status: "PROCESSED",
            gatewayRefundId,
            resolvedAt: new Date(),
            resolvedBy: "SYSTEM",
          },
        })
      }
    } catch (refundErr) {
      logger.error({ refundErr, paymentId: payment.id }, "Auto-refund via gateway failed")
      // Not fatal — admin will review and process manually
    }
  }

  // Fetch user info for emails
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  })

  // Send refund confirmation to buyer
  await emailQueue.add(EMAIL_JOBS.SEND_REFUND_CONFIRMATION, {
    to: user?.email,
    name: user?.name,
    userId,
    productName: entitlement.product.name,
    refundAmount: String(refundAmount),
    fullRefundAmount: String(fullRefundAmount),
    isPartialRefund,
    reasonCategory: category,
    currency: "USD",
    gateway: payment?.gateway?.toString() ?? "Payment Gateway",
    gatewayRefundId,
    estimatedDays: "5-7",
  })

  // Notify admin
  await emailQueue.add(EMAIL_JOBS.SEND_ADMIN_REFUND_ALERT, {
    userName: user?.name ?? "Unknown User",
    userEmail: user?.email ?? userId,
    productName: entitlement.product.name,
    reason: reason.trim(),
    refundAmount: String(refundAmount),
    currency: "USD",
    refundRequestId: refundRequest.id,
    adminUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/payments?tab=refunds`,
  })

  // Emit platform event
  await emitEvent({
    type: EVENTS.REFUND_REQUESTED,
    timestamp: new Date().toISOString(),
    actorId: userId,
    payload: {
      refundRequestId: refundRequest.id,
      entitlementId,
      productId: entitlement.productId,
      productName: entitlement.product.name,
      userId,
      refundAmount,
      reason: reason.trim(),
      autoProcessed: !!gatewayRefundId,
      isPartialRefund,
      reasonCategory: category,
    },
  })

  logger.info(
    { refundRequestId: refundRequest.id, userId, entitlementId, autoProcessed: !!gatewayRefundId },
    "Refund request created"
  )

  return NextResponse.json({
    data: {
      refundRequestId: refundRequest.id,
      status: refundRequest.status,
      refundAmount,
      autoProcessed: !!gatewayRefundId,
      isPartialRefund,
      gatewayRefundId,
      message: gatewayRefundId
        ? `Refund of ${isPartialRefund ? `${refundAmount} (partial)` : refundAmount} processed automatically. You will receive a confirmation email.`
        : "Refund request submitted. Our team will process it within 1-2 business days.",
    },
  })
}

/**
 * GET /api/refunds/request?entitlementId=xxx
 *
 * Check refund eligibility for a specific entitlement.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const entitlementId = searchParams.get("entitlementId")

  if (!entitlementId) {
    return NextResponse.json({ error: "entitlementId is required" }, { status: 400 })
  }

  const entitlement = await db.customerEntitlement.findUnique({
    where: { id: entitlementId },
    select: {
      userId: true,
      refundEligibleUntil: true,
      refundRequested: true,
      status: true,
    },
  })

  if (!entitlement || entitlement.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const now = new Date()
  const eligible =
    !entitlement.refundRequested &&
    !!entitlement.refundEligibleUntil &&
    entitlement.refundEligibleUntil > now

  const secondsRemaining = entitlement.refundEligibleUntil
    ? Math.max(0, Math.floor((entitlement.refundEligibleUntil.getTime() - now.getTime()) / 1000))
    : 0

  return NextResponse.json({
    data: {
      eligible,
      refundRequested: entitlement.refundRequested,
      refundEligibleUntil: entitlement.refundEligibleUntil,
      secondsRemaining,
      windowClosed: !eligible && !entitlement.refundRequested,
    },
  })
}
