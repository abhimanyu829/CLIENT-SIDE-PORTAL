import { db } from "@/lib/db"
import { serializePrisma } from "@/lib/serialize-prisma"
import AdminServiceRequestsClient from "./AdminServiceRequestsClient"
import { requireServiceOperationsAccess } from "@/lib/admin-auth"

function toIso(val: Date | string | null | undefined): string | null {
  if (val == null) return null
  if (val instanceof Date) return val.toISOString()
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export default async function AdminServiceRequestsPage({ searchParams }: { searchParams?: Promise<{ category?: string }> }) {
  await requireServiceOperationsAccess("requests")
  const { category } = (await searchParams) ?? {}

  const requests = await db.serviceRequest.findMany({
    orderBy: { createdAt: "desc" },
    where: category
      ? {
          servicePage: {
            category: { slug: category },
          },
        }
      : undefined,
    include: { servicePage: { select: { title: true, slug: true } } },
  })

  const serialized = serializePrisma(requests).map((request: any) => ({
    ...request,
    createdAt: toIso(request.createdAt) ?? "",
    updatedAt: toIso(request.updatedAt) ?? "",
    reviewedAt: toIso(request.reviewedAt),
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Service Requests</h1>
        <p className="mt-1 text-gray-400">Review cancellation and refund requests submitted from the service platform{category ? ` for ${category}` : ""}.</p>
      </div>
      <AdminServiceRequestsClient initialRequests={serialized} />
    </div>
  )
}
