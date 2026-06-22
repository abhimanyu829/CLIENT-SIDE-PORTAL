import { db } from "@/lib/db"
import AdminServiceCategoriesClient from "./AdminServiceCategoriesClient"

function toIso(val: Date | string | null | undefined): string | null {
  if (val == null) return null
  if (val instanceof Date) return val.toISOString()
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export default async function AdminServiceCategoriesPage() {
  const categories = await db.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { services: true } } },
  })

  const serialized = categories.map((category) => ({
    ...category,
    createdAt: toIso(category.createdAt) ?? "",
    updatedAt: toIso(category.updatedAt) ?? "",
  }))

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Service Categories</h1>
        <p className="text-gray-400 mt-1">Organize the service platform into dedicated business verticals.</p>
      </div>
      <AdminServiceCategoriesClient initialCategories={serialized} />
    </div>
  )
}
