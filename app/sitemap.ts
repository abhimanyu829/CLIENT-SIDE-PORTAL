import { MetadataRoute } from "next"
import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Fetch all published product slugs
  let productSlugs: { slug: string; updatedAt: Date }[] = []
  try {
    productSlugs = await db.product.findMany({
      where: { status: ProductStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
    })
  } catch {}

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/marketplace`, lastModified: new Date(), changeFrequency: "daily", priority: 0.95 },
    { url: `${baseUrl}/ai-agents`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.75 },
    { url: `${baseUrl}/demo`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ]

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = [
    "ai-agents", "saas", "api-tools", "automation", "enterprise", "marketing", "analytics", "digital",
  ].map(cat => ({
    url: `${baseUrl}/categories/${cat}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  // Product detail pages
  const productPages: MetadataRoute.Sitemap = productSlugs.map(p => ({
    url: `${baseUrl}/marketplace/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }))

  return [...staticPages, ...categoryPages, ...productPages]
}
