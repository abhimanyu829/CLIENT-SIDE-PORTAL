import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import OrdersClient from "./OrdersClient"

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>
}) {
  await requireAdmin()

  const params = await searchParams
  const status = params?.status ?? ""
  const gateway = params?.gateway ?? ""
  const from = params?.from ?? ""
  const to = params?.to ?? ""
  const page = Math.max(1, Number(params?.page ?? 1))
  const limit = 20
  const skip = (page - 1) * limit

  const where: any = {}

  if (status) {
    where.status = status
  }
  if (gateway) {
    where.gateway = gateway
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      include: {
        user: { select: { id: true, name: true, email: true } },
        subscription: { include: { product: true, tier: true } },
        invoice: true,
      },
    }),
    db.payment.count({ where }),
  ])

  // Revenue metrics summary
  const summary = await db.payment.groupBy({
    by: ["status"],
    where: {
      ...(from || to ? { createdAt: where.createdAt } : {}),
    },
    _sum: { amount: true },
    _count: true,
  })

  // Format payments for serializability in Next.js Server-to-Client boundary
  const formattedPayments = payments.map((p) => ({
    ...p,
    amount: String(p.amount),
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
    subscription: p.subscription
      ? {
          ...p.subscription,
          currentPeriodStart: p.subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: p.subscription.currentPeriodEnd.toISOString(),
          createdAt: p.subscription.createdAt.toISOString(),
          updatedAt: p.subscription.updatedAt.toISOString(),
          cancelledAt: p.subscription.cancelledAt?.toISOString() ?? null,
          trialEndsAt: p.subscription.trialEndsAt?.toISOString() ?? null,
          tier: {
            ...p.subscription.tier,
            price: String(p.subscription.tier.price),
            createdAt: p.subscription.tier.createdAt.toISOString(),
          },
        }
      : null,
    invoice: p.invoice
      ? {
          ...p.invoice,
          totalAmount: String(p.invoice.totalAmount),
          taxAmount: String(p.invoice.taxAmount),
          issuedAt: p.invoice.issuedAt.toISOString(),
        }
      : null,
  }))

  const metrics = {
    totalRevenue: summary.filter((s) => s.status === "SUCCESS").reduce((acc, curr) => acc + Number(curr._sum.amount ?? 0), 0),
    successCount: summary.find((s) => s.status === "SUCCESS")?._count ?? 0,
    failedCount: summary.find((s) => s.status === "FAILED")?._count ?? 0,
    refundedCount: summary.find((s) => s.status === "REFUNDED")?._count ?? 0,
    refundedAmount: summary.filter((s) => s.status === "REFUNDED").reduce((acc, curr) => acc + Number(curr._sum.amount ?? 0), 0),
  }

  // Real disputes from WebhookEvent table — gracefully handle missing table pre-migration
  let disputes: any[] = []
  try {
    const disputeEvents = await db.webhookEvent.findMany({
      where: {
        eventType: { in: ["charge.dispute.created", "payment.dispute.created"] },
        status: { not: "PROCESSED" },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    disputes = disputeEvents.map((ev) => {
      const payload = ev.payload as any
      const dispute = payload?.data?.object ?? payload?.payload?.dispute?.entity ?? {}
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? ""
      return {
        id: dispute.id ?? ev.id,
        gateway: ev.source,
        amount: (dispute.amount ?? 0) / 100,
        status: dispute.status ?? "UNKNOWN",
        deadline: dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        user: chargeId,
        email: dispute.customer_email ?? "",
        reason: dispute.reason ?? "unknown",
      }
    })
  } catch {
    // WebhookEvent table not yet migrated — show empty disputes
    disputes = []
  }

  return (
    <OrdersClient
      payments={formattedPayments}
      total={total}
      page={page}
      limit={limit}
      currentStatus={status}
      currentGateway={gateway}
      currentFrom={from}
      currentTo={to}
      metrics={metrics}
      disputes={disputes}
    />
  )
}
