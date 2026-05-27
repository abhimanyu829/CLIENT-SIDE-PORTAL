/**
 * app/api/admin/payments/retry/route.ts
 *
 * Admin endpoint to retry a failed or stuck payment.
 *
 * POST /api/admin/payments/retry
 * Body: { paymentId: string }
 *
 * Strategy:
 *   1. Validate admin session
 *   2. Load the payment from DB
 *   3. Check that Razorpay shows it as "captured" (webhook may have been missed)
 *   4. If captured → call markOrderPaid() to reconcile DB state
 *   5. If not captured → return instructions for user to retry checkout
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { getRazorpay } from "@/lib/razorpay"
import { markOrderPaid } from "@/lib/services/enterprise-commerce-service"
import { auditLog } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()

  let body: { paymentId?: string; orderId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }

  const paymentId = body.paymentId
  const orderId = body.orderId

  if (!paymentId && !orderId) {
    return NextResponse.json(
      { success: false, error: "paymentId or orderId is required" },
      { status: 400 }
    )
  }

  console.log(`[ADMIN RETRY] Admin ${admin.userId} retrying payment. paymentId=${paymentId} orderId=${orderId}`)

  // ── 1. Find the payment record ──────────────────────────────────────────────
  const payment = paymentId
    ? await db.payment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      })
    : await db.payment.findFirst({
        where: { order: { id: orderId } },
        orderBy: { createdAt: "desc" },
        include: { order: true },
      })

  if (!payment) {
    return NextResponse.json(
      { success: false, error: "Payment record not found" },
      { status: 404 }
    )
  }

  if (payment.status === "SUCCESS") {
    return NextResponse.json({
      success: true,
      alreadyPaid: true,
      message: "Payment is already marked as successful. No action required.",
    })
  }

  // ── 2. Check Razorpay for actual payment status ─────────────────────────────
  const client = getRazorpay()

  if (!client) {
    return NextResponse.json(
      { success: false, error: "Razorpay is not configured — cannot verify payment status" },
      { status: 503 }
    )
  }

  // If we have a gatewayPaymentId, check payment status directly
  if (payment.gatewayPaymentId) {
    try {
      const rzpPayment = await (client as any).payments.fetch(payment.gatewayPaymentId)
      console.log(`[ADMIN RETRY] Razorpay payment status: ${rzpPayment.status} for ${payment.gatewayPaymentId}`)

      if (rzpPayment.status === "captured") {
        // Payment was captured on Razorpay but our webhook/verify missed it
        // Reconcile now
        const targetOrderId = payment.orderId ?? orderId
        if (!targetOrderId) {
          return NextResponse.json(
            { success: false, error: "Cannot reconcile: payment has no associated order" },
            { status: 400 }
          )
        }

        const paid = await markOrderPaid(
          targetOrderId,
          payment.gatewayPaymentId,
          payment.gatewayOrderId ?? rzpPayment.order_id
        )

        await auditLog({
          action: "admin.payment.retry.reconciled",
          entity: "Payment",
          entityId: payment.id,
          userId: admin.userId,
          after: {
            gatewayPaymentId: payment.gatewayPaymentId,
            newStatus: paid.status,
            reconciledBy: admin.userId,
          },
        })

        console.log(`[ADMIN RETRY] ✅ Reconciled order ${paid.orderNumber} to status ${paid.status}`)

        return NextResponse.json({
          success: true,
          reconciled: true,
          message: `Payment was captured on Razorpay but our records were out of sync. Order ${paid.orderNumber} has now been marked as paid and subscription access provisioned.`,
          data: {
            orderId: paid.id,
            orderNumber: paid.orderNumber,
            status: paid.status,
          },
        })
      }

      if (rzpPayment.status === "failed") {
        return NextResponse.json({
          success: false,
          gatewayStatus: "failed",
          message: `Payment failed on Razorpay (reason: ${rzpPayment.error_description ?? "unknown"}). The user must initiate a new checkout.`,
        })
      }

      // authorized / created / refunded / etc.
      return NextResponse.json({
        success: false,
        gatewayStatus: rzpPayment.status,
        message: `Payment is in "${rzpPayment.status}" state on Razorpay. Cannot auto-reconcile. Please check the Razorpay dashboard.`,
      })
    } catch (err: any) {
      console.error("[ADMIN RETRY] Razorpay fetch failed:", err)
      return NextResponse.json(
        { success: false, error: `Razorpay error: ${err.message ?? "Unknown"}` },
        { status: 502 }
      )
    }
  }

  // ── 3. No gatewayPaymentId — try fetching by gatewayOrderId ────────────────
  if (payment.gatewayOrderId) {
    try {
      const rzpOrder = await (client as any).orders.fetch(payment.gatewayOrderId)
      const rzpStatus = rzpOrder?.status
      console.log(`[ADMIN RETRY] Razorpay order status: ${rzpStatus} for order ${payment.gatewayOrderId}`)

      if (rzpStatus === "paid") {
        // Fetch the payments for this order
        const paymentsResponse = await (client as any).orders.fetchPayments(payment.gatewayOrderId)
        const capturedPayment = paymentsResponse?.items?.find((p: any) => p.status === "captured")

        if (capturedPayment) {
          const targetOrderId = payment.orderId ?? orderId
          if (!targetOrderId) {
            return NextResponse.json(
              { success: false, error: "Cannot reconcile: no order ID found" },
              { status: 400 }
            )
          }

          const paid = await markOrderPaid(
            targetOrderId,
            capturedPayment.id,
            payment.gatewayOrderId
          )

          await auditLog({
            action: "admin.payment.retry.order-reconciled",
            entity: "Payment",
            entityId: payment.id,
            userId: admin.userId,
            after: {
              gatewayOrderId: payment.gatewayOrderId,
              capturedPaymentId: capturedPayment.id,
              newStatus: paid.status,
            },
          })

          return NextResponse.json({
            success: true,
            reconciled: true,
            message: `Found captured payment ${capturedPayment.id} for Razorpay order. Order ${paid.orderNumber} has been reconciled to paid.`,
            data: {
              orderId: paid.id,
              orderNumber: paid.orderNumber,
              status: paid.status,
            },
          })
        }
      }

      return NextResponse.json({
        success: false,
        gatewayStatus: rzpStatus,
        message: `Razorpay order is in "${rzpStatus}" state. No captured payment found. The user must initiate a new checkout.`,
      })
    } catch (err: any) {
      console.error("[ADMIN RETRY] Razorpay order fetch failed:", err)
      return NextResponse.json(
        { success: false, error: `Razorpay error: ${err.message ?? "Unknown"}` },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({
    success: false,
    message: "No Razorpay payment ID or order ID available. Cannot reconcile. The user must initiate a fresh checkout.",
  })
}
