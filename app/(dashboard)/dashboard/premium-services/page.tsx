import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { serializePrisma } from "@/lib/serialize-prisma"
import PremiumServicesClient from "./PremiumServicesClient"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Premium Services | Dashboard",
  description: "Browse and manage your premium services and add-ons.",
}

export default async function PremiumServicesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  // Fetch available premium services (active only)
  const [services, categories, userSubscription] = await Promise.all([
    db.premiumService.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        addonServices: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
    }),

    db.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),

    // Get user's active plan subscription
    db.userSubscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
      include: {
        plan: {
          include: {
            benefits: { orderBy: { sortOrder: "asc" } },
          },
        },
        addons: {
          where: { isActive: true },
          include: {
            addonService: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return (
    <PremiumServicesClient
      services={serializePrisma(services) as any}
      categories={categories}
      userSubscription={serializePrisma(userSubscription) as any}
    />
  )
}
