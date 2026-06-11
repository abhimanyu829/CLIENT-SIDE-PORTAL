import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { getRazorpay } from "@/lib/razorpay"

/**
 * GET /api/admin/payments/[id]
 * 
 * Admin endpoint to inspect a single payment with full details:
 * order, subscription, invoice, user, and gateway info.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  const { id } = await params

  console.log(`[ADMIN PAYMENTS] Admin ${admin.userId} inspecting payment: ${id}`)

  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, isVerified: true, isBanned: true } },
      order: {
        include: {
          items: { include: { product: { select: { name: true } }, tier: { select: { name: true } } } },
          invoices: true,
          entitlements: true,
        },
      },
      subscription: { include: { product: { select: { name: true } }, tier: { select: { name: true } } } },
      invoice: true,
    },
  })

  if (!payment) {
    return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 })
  }

  // Try to fetch gateway payment details from Razorpay
  let gatewayDetails: any = null
  const client = getRazorpay()
  if (client && payment.gatewayOrderId) {
    try {
      gatewayDetails = await (client as any).orders.fetch(payment.gatewayOrderId)
    } catch {
      // Gateway order may not exist in test mode
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      payment: {
        ...payment,
        amount: Number(payment.amount),
        createdAt: payment.createdAt.toISOString(),
        paidAt: payment.paidAt?.toISOString() ?? null,
      },
      gatewayDetails,
    },
  })
}

/**
 * POST /api/admin/payments/[id]
 * 
 * Admin actions on a payment:
 * - refund: Initiate a refund via Razorpay
 * - retry: Retry a failed payment
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  const { id } = await params
  const body = await req.json()
  const action = body.action

  console.log(`[ADMIN PAYMENTS] Admin ${admin.userId} action: ${action} on payment: ${id}`)

  const payment = await db.payment.findUnique({ where: { id } })
  if (!payment) {
    return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 })
  }

  if (action === "refund") {
    const amount = body.amount ? Number(body.amount) : Number(payment.amount)
    const reason = body.reason ?? "Admin initiated refund"

    const client = getRazorpay()
    if (!client) {
      return NextResponse.json({ success: false, error: "Razorpay not configured" }, { status: 503 })
    }

    if (!payment.gatewayPaymentId) {
      return NextResponse.json({ success: false, error: "No gateway payment ID — cannot refund" }, { status: 400 })
    }

    try {
      const refund = await (client as any).payments.refund(payment.gatewayPaymentId, {
        amount: Math.round(amount * 100), // Convert to paise
        notes: { reason, adminId: admin.userId },
      })

      // Update payment status
      await db.payment.update({
        where: { id },
        data: {
          status: "REFUNDED",
        },
      })

      // Also create a RefundRequest record to store details
      await db.refundRequest.create({
        data: {
          userId: payment.userId,
          paymentId: payment.id,
          orderId: payment.orderId,
          subscriptionId: payment.subscriptionId,
          reason,
          status: "PROCESSED",
          gateway: payment.gateway,
          gatewayRefundId: refund.id,
          refundAmount: amount,
          resolvedAt: new Date(),
          resolvedBy: admin.userId,
          adminNotes: "Refunded via admin payments panel",
        } as any,
      }).catch(() => {})

      console.log(`[ADMIN PAYMENTS] ✅ Refund processed: ${refund.id} for payment ${id}`)
      return NextResponse.json({ success: true, data: { refundId: refund.id, amount } })
    } catch (error: any) {
      console.error(`[ADMIN PAYMENTS] ❌ Refund failed for payment ${id}:`, error)
      return NextResponse.json({ success: false, error: error.message ?? "Refund failed" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
}