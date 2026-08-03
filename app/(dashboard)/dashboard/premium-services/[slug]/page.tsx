import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { serializePrisma } from "@/lib/serialize-prisma"
import PremiumServiceDetailClient from "./PremiumServiceDetailClient"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const service = await db.premiumService.findUnique({ where: { slug }, select: { name: true, shortDescription: true } })
  if (!service) return {}
  return { title: `${service.name} | Premium Services`, description: service.shortDescription }
}

export default async function PremiumServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { slug } = await params

  const [service, userPurchasedService, product] = await Promise.all([
    db.premiumService.findUnique({
      where: { slug, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        addonServices: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
    db.purchasedService.findFirst({
      where: { userId: session.user.id, status: { notIn: ["ARCHIVED"] }, product: { slug } },
      select: { id: true, status: true },
    }),
    db.product.findFirst({
      where: { slug, status: "AVAILABLE" },
      include: { tiers: { where: { isActive: true }, orderBy: { price: "asc" } } },
    }),
  ])

  if (!service) notFound()

  // ── Auto-sync: if no Product row exists for this service slug, create one ──
  let resolvedProduct = product
  if (!resolvedProduct) {
    try {
      resolvedProduct = await db.product.upsert({
        where: { slug: service.slug },
        update: {
          name: service.name,
          tagline: service.shortDescription,
          description: service.fullDescription ?? service.shortDescription,
          status: "AVAILABLE",
          iconUrl: service.iconUrl ?? undefined,
          bannerUrl: service.bannerUrl ?? undefined,
          // Heal tiers synced before deployment management existed — premium
          // services are always admin-deployed, never instant HOSTED delivery.
          tiers: { updateMany: { where: {}, data: { fulfillmentType: "SERVICE_DELIVERY" } } },
        },
        create: {
          slug: service.slug,
          name: service.name,
          tagline: service.shortDescription,
          description: service.fullDescription ?? service.shortDescription,
          type: "SERVICE",
          status: "AVAILABLE",
          features: [],
          createdBy: session.user.id,
          iconUrl: service.iconUrl ?? undefined,
          bannerUrl: service.bannerUrl ?? undefined,
          tiers: {
            create: {
              name: service.name,
              price: service.basePrice,
              currency: service.currency,
              interval: (["MONTHLY","YEARLY","WEEKLY"] as const).includes(service.billingCycle as any)
                ? (service.billingCycle as any)
                : service.billingCycle === "LIFETIME"
                ? "ONE_TIME"
                : service.billingCycle === "USAGE_BASED"
                ? "USAGE_BASED"
                : "MONTHLY",
              fulfillmentType: "SERVICE_DELIVERY",
              isActive: true,
            },
          },
        },
        include: { tiers: { where: { isActive: true }, orderBy: { price: "asc" } } },
      }) as any
    } catch (err) {
      console.error("[PremiumServiceDetailPage] product auto-sync failed:", err)
    }
  }

  return (
    <PremiumServiceDetailClient
      service={serializePrisma(service) as any}
      product={resolvedProduct ? serializePrisma(resolvedProduct) as any : null}
      alreadyOwned={!!userPurchasedService}
      purchasedServiceId={userPurchasedService?.id ?? null}
    />
  )
}