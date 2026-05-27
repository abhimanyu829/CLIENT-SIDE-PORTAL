/**
 * app/api/admin/payments/checkout-failures/route.ts
 *
 * Returns orders that are in PENDING state with failed or missing payments.
 * These represent users who started checkout but payment was not captured.
 * Used by the admin panel for payment failure inspection and retry.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { getRazorpay } from "@/lib/razorpay"

export async function GET(req: NextRequest) {
  await requireAdmin()

  const url = req.nextUrl
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1))
  const limit = 20
  const skip = (page - 1) * limit
  const gateway = url.searchParams.get("gateway") ?? ""

  const where: any = {
    status: { in: ["PENDING", "FAILED"] },
    ...(gateway ? { gateway } : {}),
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      include: {
        user: { select: { id: true, name: true, email: true } },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        items: {
          take: 3,
          include: {
            product: { select: { name: true } },
            tier: { select: { name: true, interval: true } },
          },
        },
      },
    }),
    db.order.count({ where }),
  ])

  // For PENDING orders with a gatewayOrderId, try to check Razorpay status
  const client = getRazorpay()
  const enrichedOrders = await Promise.all(
    orders.map(async (order) => {
      const payment = order.payments[0]
      let gatewayStatus: string | null = null
      let gatewayError: string | null = null

      if (client && payment?.gatewayOrderId && order.status === "PENDING") {
        try {
          const rzpOrder = await (client as any).orders.fetch(payment.gatewayOrderId)
          gatewayStatus = rzpOrder?.status ?? null
        } catch (err: any) {
          gatewayError = err?.message?.slice(0, 100) ?? "Unable to fetch from Razorpay"
        }
      }

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        gateway: order.gateway,
        grandTotal: String(order.grandTotal),
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        paidAt: order.paidAt?.toISOString() ?? null,
        user: order.user,
        items: order.items.map(item => ({
          name: item.product.name,
          tier: item.tier?.name ?? "—",
          interval: item.tier?.interval ?? "—",
        })),
        payment: payment ? {
          id: payment.id,
          status: payment.status,
          gatewayPaymentId: payment.gatewayPaymentId,
          gatewayOrderId: payment.gatewayOrderId,
          failureReason: payment.failureReason,
          createdAt: payment.createdAt.toISOString(),
        } : null,
        gatewayStatus,
        gatewayError,
      }
    })
  )

  return NextResponse.json({
    success: true,
    data: {
      orders: enrichedOrders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
  })
}
