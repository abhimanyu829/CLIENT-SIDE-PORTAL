/**
 * app/(admin)/admin/payments/page.tsx
 *
 * Enterprise Admin: Payment Inspection Dashboard
 * Shows checkout failures, payment states, invoice inspection, and QR payment logs.
 */

import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import PaymentsInspectionClient from "./PaymentsInspectionClient"

export const dynamic = "force-dynamic"

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>
}) {
  await requireAdmin()

  const params = await searchParams
  const tab = params?.tab ?? "failures"
  const gateway = params?.gateway ?? ""
  const page = Math.max(1, Number(params?.page ?? 1))
  const limit = 20
  const skip = (page - 1) * limit

  // Checkout failures — PENDING orders with associated payment attempts
  const [checkoutFailures, failuresTotal] = await Promise.all([
    db.order.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        ...(gateway ? { gateway: gateway as any } : {}),
      },
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
    db.order.count({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        ...(gateway ? { gateway: gateway as any } : {}),
      },
    }),
  ])

  // Recent successful payments for comparison
  const recentSuccessful = await db.payment.findMany({
    where: { status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      user: { select: { id: true, name: true, email: true } },
      invoice: { select: { id: true, number: true, status: true } },
    },
  })

  // Pending payments (started but not captured)
  const pendingPayments = await db.payment.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      user: { select: { id: true, name: true, email: true } },
      order: { select: { id: true, orderNumber: true, grandTotal: true, currency: true } },
    },
  })

  // Failed payments
  const failedPayments = await db.payment.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      user: { select: { id: true, name: true, email: true } },
      order: { select: { id: true, orderNumber: true, grandTotal: true, currency: true } },
    },
  })

  // Summary counts
  const [successCount, failedCount, pendingCount, refundedCount, disputedCount] = await Promise.all([
    db.payment.count({ where: { status: "SUCCESS" } }),
    db.payment.count({ where: { status: "FAILED" } }),
    db.payment.count({ where: { status: "PENDING" } }),
    db.payment.count({ where: { status: "REFUNDED" } }),
    db.payment.count({ where: { status: "DISPUTED" } }),
  ])

  // Webhook failure counts for context
  const webhookFailures = await db.webhookEvent.count({
    where: {
      source: "RAZORPAY",
      status: { in: ["FAILED", "DEAD"] },
    },
  })

  const serialize = (obj: any): any => {
    if (obj === null || obj === undefined) return obj
    if (obj instanceof Date) return obj.toISOString()
    if (typeof obj === "bigint") return String(obj)
    if (obj?.constructor?.name === "Decimal") return String(obj)
    if (Array.isArray(obj)) return obj.map(serialize)
    if (typeof obj === "object") {
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
    }
    return obj
  }

  return (
    <PaymentsInspectionClient
      tab={tab}
      gateway={gateway}
      page={page}
      limit={limit}
      failuresTotal={failuresTotal}
      checkoutFailures={serialize(checkoutFailures)}
      recentSuccessful={serialize(recentSuccessful)}
      pendingPayments={serialize(pendingPayments)}
      failedPayments={serialize(failedPayments)}
      counts={{ successCount, failedCount, pendingCount, refundedCount, disputedCount, webhookFailures }}
    />
  )
}
