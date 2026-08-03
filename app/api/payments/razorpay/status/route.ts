import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
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

  const session = await auth()
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
      items: { select: { fulfillmentType: true, tier: { select: { fulfillmentType: true } }, product: { select: { serviceProfile: { select: { id: true } } } } } },
      purchasedServices: { select: { id: true, status: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  })

  if (!order) {
    console.error(`[RAZORPAY STATUS] ❌ Order not found: ${orderId}`)
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 })
  }

  // If order is already paid/fulfilled, return immediately
  if (order.status === "PAID" || order.status === "FULFILLED") {
    const service = order.purchasedServices[0]

    // Every paid order produces a deployment queue job (business rule:
    // payment verified ⇒ deployment queued), so a missing service record
    // always means "creation pending or failed" — never "not applicable".
    const hasDeploymentItems = true

    // Race condition guard: markOrderPaid fires billing.refresh before
    // createPurchasedServicesForOrder completes. If the service record is
    // not yet created, keep the client polling with DEPLOYMENT_QUEUED so
    // it will pick up the deploymentUrl on the next cycle.
    if (hasDeploymentItems && !service) {
      console.log(`[RAZORPAY STATUS] ⏳ Order ${order.orderNumber} PAID but purchasedService not yet created — attempting queue creation heal`)
      // Healing: order paid but queue job missing (earlier failure or a tier
      // fixed after checkout). Creation is idempotent per order item.
      const lifecycle = await import("@/lib/services/service-lifecycle-service")
      await lifecycle.createPurchasedServicesForOrder(order.id).catch((err) =>
        logger.error({ err, orderId: order.id }, "deployment queue healing failed in status route"),
      )
      const healed = await db.purchasedService.findFirst({
        where: { orderId: order.id, userId: session.user.id },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      })
      if (healed) {
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
            deploymentUrl: `/dashboard/services/${healed.id}`,
          },
        })
      }
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
          paymentStatus: "DEPLOYMENT_QUEUED",
        },
      })
    }

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
        deploymentUrl: service ? `/dashboard/services/${service.id}` : null,
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
        const service = await db.purchasedService.findFirst({
          where: { orderId: paid.id, userId: session.user.id },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        })
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
            deploymentUrl: service ? `/dashboard/services/${service.id}` : null,
          },
        })
      }
    } catch (error) {
      console.warn("[RAZORPAY STATUS] ⚠️ Unable to reconcile Razorpay order status:", error)
      logger.warn({ error, orderId }, "Unable to reconcile Razorpay order status")
    }
  }

  // Check if manual payment verification was REJECTED
  const rejectedVerification = await db.paymentVerification.findFirst({
    where: { orderId: order.id, verificationStatus: "REJECTED" },
    orderBy: { lastReviewedAt: "desc" },
  })

  if (rejectedVerification) {
    console.log(`[RAZORPAY STATUS] ❌ Order ${order.orderNumber} has a REJECTED verification`)
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
        paymentStatus: "REJECTED",
        rejectionReason: rejectedVerification.mismatchReason ?? "Rejected by admin",
        redirectUrl: `/checkout/failure?error=PAYMENT_DENIED&orderId=${order.id}&message=${encodeURIComponent(rejectedVerification.mismatchReason ?? "Your payment was rejected by admin")}`,
        gatewayOrderId: latestPayment?.gatewayOrderId ?? null,
      },
    })
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
