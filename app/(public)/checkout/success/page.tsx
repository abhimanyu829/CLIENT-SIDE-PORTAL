import Link from "next/link"
import { redirect } from "next/navigation"
import { BadgeCheck, FileText, LayoutDashboard, PackageCheck } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import SuccessClient from "./SuccessClient"

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const params = await searchParams
  const orderId = params?.orderId
  if (!orderId) redirect("/dashboard/subscriptions")

  const order = await db.order.findFirst({
    where: { id: orderId, userId: session.user.id },
    include: {
      items: {
        include: {
          product: { select: { name: true, category: true, serviceProfile: { select: { freeServices: true } } } },
          tier: { select: { name: true, interval: true } },
        },
      },
      invoices: { select: { id: true, number: true }, take: 1 },
      payments: {
        select: { gateway: true, gatewayPaymentId: true, status: true, paidAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!order) redirect("/dashboard/subscriptions")

  const payment = order.payments.find((p) => p.status === "SUCCESS") ?? order.payments[0] ?? null

  // Serialize for client component — amounts/pricing are backend-confirmed
  // values read straight from the order/invoice records; the client only renders.
  const serializedOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    gateway: order.gateway,
    currency: order.currency,
    subtotal: Number(order.subtotal),
    discountTotal: Number(order.discountTotal),
    taxTotal: Number(order.taxTotal),
    grandTotal: Number(order.grandTotal),
    paidAt: order.paidAt?.toISOString() ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      tierName: item.tier?.name ?? "Default",
      interval: item.tier?.interval ?? null,
      fulfillmentType: item.fulfillmentType,
      productName: item.product.name,
      category: item.product.category ?? null,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      freeServices: Array.isArray(item.product.serviceProfile?.freeServices)
        ? (item.product.serviceProfile!.freeServices as any[])
            .map((s) => (typeof s === "string" ? s : s?.name))
            .filter(Boolean)
        : [],
    })),
    invoiceId: order.invoices[0]?.id ?? null,
    invoiceNumber: order.invoices[0]?.number ?? null,
    payment: payment
      ? { gateway: payment.gateway, gatewayPaymentId: payment.gatewayPaymentId, status: payment.status, paidAt: payment.paidAt?.toISOString() ?? null }
      : null,
  }

  return <SuccessClient order={serializedOrder} userId={session.user.id} />
}
