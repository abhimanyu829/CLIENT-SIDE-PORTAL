import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminProductsClient from "./AdminProductsClient"

export default async function AdminProductsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard")

  const products = await db.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      tiers: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true, currency: true }
      },
      _count: { select: { subscriptions: true } }
    }
  })

  const serialized = products.map(p => ({
    ...p,
    tiers: p.tiers.map(t => ({ ...t, price: Number(t.price) }))
  }))

  return <AdminProductsClient initialProducts={serialized} />
}
