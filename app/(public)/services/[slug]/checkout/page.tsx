import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { serializePrisma } from "@/lib/serialize-prisma"
import ServiceCheckoutClient from "./ServiceCheckoutClient"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const service = await db.servicePage.findUnique({ where: { slug } })
  if (!service) return { title: "Service Checkout" }
  return {
    title: `${service.title} Checkout | NexusAI Services`,
    description: service.heroSubheading,
  }
}

export default async function ServiceCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const service = await db.servicePage.findUnique({
    where: { slug },
    include: {
      category: true,
      plans: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      addOns: { where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  })

  if (!service || !service.isActive) notFound()

  const serialized = serializePrisma({
    id: service.id,
    slug: service.slug,
    title: service.title,
    heroHeading: service.heroHeading,
    heroSubheading: service.heroSubheading,
    plans: service.plans,
    addOns: service.addOns,
  })

  return (
    <div className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-7xl">
        <ServiceCheckoutClient service={serialized as any} />
      </div>
    </div>
  )
}
