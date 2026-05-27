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
      items: { include: { product: true, tier: true } },
      invoices: true,
      payments: true,
      entitlements: true,
    },
  })

  if (!order) redirect("/dashboard/subscriptions")

  // Serialize for client component
  const serializedOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    grandTotal: Number(order.grandTotal),
    paidAt: order.paidAt?.toISOString() ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      tierName: item.tier?.name ?? "Default",
      fulfillmentType: item.fulfillmentType,
      productName: item.product.name,
    })),
    invoiceId: order.invoices[0]?.id ?? null,
  }

  return <SuccessClient order={serializedOrder} />
}