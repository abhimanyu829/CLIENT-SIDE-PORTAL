import { db } from "@/lib/db"
import { serializePrisma } from "@/lib/serialize-prisma"
import AdminServiceOrdersClient from "./AdminServiceOrdersClient"
import { requireServiceOperationsAccess } from "@/lib/admin-auth"

function toIso(val: Date | string | null | undefined): string | null {
  if (val == null) return null
  if (val instanceof Date) return val.toISOString()
  const d = new Date(val as string)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default async function AdminServiceOrdersPage({ searchParams }: { searchParams?: Promise<{ category?: string }> }) {
  await requireServiceOperationsAccess("orders")
  const { category } = (await searchParams) ?? {}

  const orders = await db.serviceOrder.findMany({
    orderBy: { createdAt: "desc" },
    where: category
      ? {
          servicePage: {
            category: { slug: category },
          },
        }
      : undefined,
    include: {
      user: { select: { name: true, email: true } },
      servicePage: { select: { title: true, slug: true } },
      servicePlan: { select: { name: true, type: true, billingLabel: true } },
    },
  })

  const serialized = serializePrisma(orders).map((order: any) => ({
    ...order,
    createdAt: toIso(order.createdAt) ?? "",
    updatedAt: toIso(order.updatedAt) ?? "",
    paidAt: toIso(order.paidAt),
    fulfilledAt: toIso(order.fulfilledAt),
  }))

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Service Orders</h1>
        <p className="mt-1 text-gray-400">Track service commerce orders created through the dedicated service checkout flow{category ? ` for ${category}` : ""}.</p>
      </div>
      <AdminServiceOrdersClient initialOrders={serialized} />
    </div>
  )
}
