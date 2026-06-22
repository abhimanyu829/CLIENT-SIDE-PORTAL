import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import AdminServiceEditClient from "./AdminServiceEditClient"
import { serializePrisma } from "@/lib/serialize-prisma"

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categories = await db.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
  const service = await db.servicePage.findUnique({
    where: { id: id },
    include: {
      category: true,
      features: { orderBy: { sortOrder: "asc" } },
      technologies: { orderBy: { sortOrder: "asc" } },
      faqs: { orderBy: { sortOrder: "asc" } },
      portfolios: { orderBy: { sortOrder: "asc" } },
      plans: { orderBy: { sortOrder: "asc" } },
      addOns: { orderBy: { sortOrder: "asc" } },
      mediaAssets: { orderBy: { sortOrder: "asc" } },
      documents: { orderBy: { sortOrder: "asc" } },
    }
  })

  if (!service) notFound()

  return <AdminServiceEditClient service={serializePrisma(service) as any} categories={serializePrisma(categories) as any} />
}
