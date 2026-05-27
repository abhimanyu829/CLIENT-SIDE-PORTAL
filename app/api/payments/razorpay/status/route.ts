import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getRazorpay } from "@/lib/razorpay"
import { markOrderPaid } from "@/lib/services/enterprise-commerce-service"
import { logger } from "@/lib/logger"

/**
 * GET /api/payments/razorpay/status?orderId=xxx
 *
 * Checks the payment status of an order. If the order is still PENDING,
 * attempts to reconcile with Razorpay's API to detect captured payments
 * that may have been missed by the webhook.
 */
export async function GET(req: NextRequest) {
  console.log("[RAZORPAY STATUS] 📨 GET /api/payments/razorpay/status — request received")

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    console.log("[RAZORPAY STATUS] ❌ No authenticated session")
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Please sign in." } }, { status: 401 })
  }

  const orderId = req.nextUrl.searchParams.get("orderId")
  if (!orderId) {
    console.error("[RAZORPAY STATUS] ❌ Missing orderId parameter")
    return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "orderId is required." } }, { status: 400 })
  }

  console.log(`[RAZORPAY STATUS] Checking status for order: ${orderId}`)

  const order = await db.order.findFirst({
    where: { id: orderId, userId: session.user.id },
    include: {
      payments: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { issuedAt: "desc" } },
      items: true,
    },
  })

  if (!order) {
    console.error(`[RAZORPAY STATUS] ❌ Order not found: ${orderId}`)
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 })
  }

  // If order is already paid/fulfilled, return immediately
  if (order.status === "PAID" || order.status === "FULFILLED") {
    console.log(`[RAZORPAY STATUS] ✅ Order ${order.orderNumber} already paid (status: ${order.status})`)
    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          amount: Number(order.grandTotal),
          currency: order.currency,
          paidAt: order.paidAt,
          invoiceId: order.invoices[0]?.id ?? null,
        },
        paymentStatus: "SUCCESS",
      },
    })
  }

  // If order is still pending, try to reconcile with Razorpay
  const latestPayment = order.payments[0]
  const client = getRazorpay()

  if (client && latestPayment?.gatewayOrderId && order.status === "PENDING") {
    try {
      console.log(`[RAZORPAY STATUS] 🔄 Reconciling Razorpay order status for gateway order: ${latestPayment.gatewayOrderId}`)
      const payments = await (client as any).orders.fetchPayments(latestPayment.gatewayOrderId)
      const captured = payments?.items?.find((item: any) => item.status === "captured" || item.captured)
      if (captured?.id) {
        console.log(`[RAZORPAY STATUS] ✅ Found captured payment: ${captured.id} — marking order as paid`)
        const paid = await markOrderPaid(order.id, captured.id, latestPayment.gatewayOrderId)
        return NextResponse.json({
          success: true,
          data: {
            order: {
              id: paid.id,
              orderNumber: paid.orderNumber,
              status: paid.status,
              amount: Number(paid.grandTotal),
              currency: paid.currency,
              paidAt: paid.paidAt,
            },
            paymentStatus: "SUCCESS",
            gatewayPaymentId: captured.id,
          },
        })
      }
    } catch (error) {
      console.warn("[RAZORPAY STATUS] ⚠️ Unable to reconcile Razorpay order status:", error)
      logger.warn({ error, orderId }, "Unable to reconcile Razorpay order status")
    }
  }

  // Return current status
  console.log(`[RAZORPAY STATUS] 📋 Order ${order.orderNumber} status: ${order.status}, payment: ${latestPayment?.status ?? "NONE"}`)

  return NextResponse.json({
    success: true,
    data: {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        amount: Number(order.grandTotal),
        currency: order.currency,
        paidAt: order.paidAt,
        invoiceId: order.invoices[0]?.id ?? null,
      },
      paymentStatus: latestPayment?.status ?? "PENDING",
      gatewayOrderId: latestPayment?.gatewayOrderId ?? null,
    },
  })
}