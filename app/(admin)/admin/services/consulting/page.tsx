import { db } from "@/lib/db"
import { requireServiceCenterAccess } from "@/lib/admin-auth"
import ServiceVerticalShell from "../_components/ServiceVerticalShell"
import { SERVICE_CENTER_CONFIG } from "../centers/center-config"

export default async function ConsultingPage() {
  await requireServiceCenterAccess("ai-consulting")

  const [category, services] = await Promise.all([
    db.serviceCategory.findUnique({ where: { slug: "ai-consulting" }, select: { name: true, slug: true } }),
    db.servicePage.findMany({
      where: { category: { slug: "ai-consulting" } },
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true, slug: true } },
        _count: { select: { leads: true, requests: true, orders: true, plans: true, addOns: true, mediaAssets: true, documents: true } },
        orders: { select: { grandTotal: true, status: true } },
      },
    }),
  ])

  return <ServiceVerticalShell config={SERVICE_CENTER_CONFIG["ai-consulting"]} categorySlug="ai-consulting" categoryLabel={category?.name} services={services as any} relatedCategorySlugs={["digital-transformation-services"]} />
}
