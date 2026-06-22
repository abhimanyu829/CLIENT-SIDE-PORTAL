import { db } from "@/lib/db"
import AdminServicesClient from "./AdminServicesClient"
import Link from "next/link"
import { Plus, Shapes, ClipboardList } from "lucide-react"

function toIso(val: Date | string | null | undefined): string | null {
  if (val == null) return null
  if (val instanceof Date) return val.toISOString()
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export default async function AdminServicesPage({ searchParams }: { searchParams?: Promise<{ category?: string }> }) {
  const { category } = (await searchParams) ?? {}

  const [categories, services] = await Promise.all([
    db.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { services: true } } },
    }),
    db.servicePage.findMany({
      where: category ? { category: { slug: category } } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        _count: { select: { leads: true } }
      }
    })
  ])

  const serialized = services.map(s => ({
    ...s,
    createdAt: toIso(s.createdAt) ?? "",
    updatedAt: toIso(s.updatedAt) ?? "",
  }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Services</h1>
          <p className="text-gray-400 mt-1">Manage public service pages, categories, content, and leads.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/services/centers" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <Shapes className="h-4 w-4" />
            Centers
          </Link>
          <Link href="/admin/services/categories" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <Shapes className="h-4 w-4" />
            Categories
          </Link>
          <Link href="/admin/services/requests" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <ClipboardList className="h-4 w-4" />
            Requests
          </Link>
          <Link href="/admin/services/new" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            <Plus className="h-4 w-4" />
            New Service
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/services" className={`rounded-full border px-4 py-2 text-sm font-medium transition ${!category ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200" : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"}`}>
          All
        </Link>
        {categories.map((item) => (
          <Link
            key={item.id}
            href={`/admin/services?category=${item.slug}`}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${category === item.slug ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200" : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"}`}
          >
            {item.name} <span className="text-xs text-zinc-500">({item._count.services})</span>
          </Link>
        ))}
      </div>
      <AdminServicesClient initialServices={serialized} />
    </div>
  )
}
