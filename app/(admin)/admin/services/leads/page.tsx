import { db } from "@/lib/db"
import AdminServiceLeadsClient from "./AdminServiceLeadsClient"
import { requireServiceOperationsAccess } from "@/lib/admin-auth"

function toIso(val: Date | string | null | undefined): string | null {
  if (val == null) return null
  if (val instanceof Date) return val.toISOString()
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export default async function AdminServiceLeadsPage({ searchParams }: { searchParams?: Promise<{ category?: string }> }) {
  await requireServiceOperationsAccess("requests")
  const { category } = (await searchParams) ?? {}

  const leads = await db.serviceLead.findMany({
    orderBy: { createdAt: "desc" },
    where: category
      ? {
          servicePage: {
            category: { slug: category },
          },
        }
      : undefined,
    include: {
      servicePage: {
        select: { title: true, slug: true }
      }
    }
  })

  const serialized = leads.map(l => ({
    ...l,
    createdAt: toIso(l.createdAt) ?? "",
    updatedAt: toIso(l.updatedAt) ?? "",
  }))

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Service Leads</h1>
          <p className="text-gray-400 mt-1">Review incoming project inquiries from service pages{category ? ` in ${category}` : ""}.</p>
        </div>
      </div>
      <AdminServiceLeadsClient initialLeads={serialized} />
    </div>
  )
}
