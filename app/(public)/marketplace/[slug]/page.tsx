import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { ProductStatus, CampaignStatus } from "@prisma/client"
import ProductDetailClient from "./ProductDetailClient"

interface Props { params: Promise<{ slug: string }> }

async function getProduct(slug: string) {
  const product = await db.product.findFirst({
    where: { slug, status: ProductStatus.PUBLISHED },
    include: {
      tiers: { orderBy: { price: "asc" } },
      reviews: {
        where: { status: "APPROVED" as any },
        orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }],
        take: 10,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      versions: { orderBy: { createdAt: "desc" }, take: 5 },
      vendor: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          status: true,
          type: true,
          sellerScore: true,
          averageRating: true,
          totalSales: true,
          badges: true,
          logoUrl: true,
        },
      },
      _count: { select: { reviews: true, subscriptions: true } },
    },
  })
  if (!product) return null

  // Increment view count async (fire-and-forget)
  db.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {})
  return product
}

async function getRelated(type: string, excludeId: string) {
  return db.product.findMany({
    where: { type: type as any, status: ProductStatus.PUBLISHED, id: { not: excludeId } },
    take: 3,
    include: { tiers: { take: 1, orderBy: { price: "asc" } } },
  })
}

async function getActiveCampaignForProduct(productId: string) {
  const now = new Date()
  return db.campaign.findFirst({
    where: {
      status: CampaignStatus.ACTIVE,
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [
        { applicableProductIds: { has: productId } },
        { applicableProductIds: { isEmpty: true } },
      ],
    },
    select: { id: true, bannerText: true, ctaText: true, discountPercent: true, endsAt: true, flatDiscount: true },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await db.product.findFirst({
    where: { slug },
    select: { name: true, description: true, thumbnailUrl: true, seoTitle: true, seoDescription: true },
  })
  if (!product) return { title: "Not Found" }
  return {
    title: product.seoTitle || `${product.name} — NexusAI Marketplace`,
    description: product.seoDescription || product.description,
    openGraph: {
      title: product.seoTitle || product.name,
      description: product.seoDescription || product.description,
      images: product.thumbnailUrl ? [{ url: product.thumbnailUrl }] : [],
    },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const [product, ] = await Promise.all([getProduct(slug)])
  if (!product) notFound()

  const [related, campaign] = await Promise.all([
    getRelated(product.type, product.id),
    getActiveCampaignForProduct(product.id),
  ])

  // Serialize for client
  const serialized = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    longDescription: product.longDescription,
    type: product.type,
    category: product.category,
    subcategory: product.subcategory,
    thumbnailUrl: product.thumbnailUrl,
    iconUrl: product.iconUrl,
    bannerUrl: product.bannerUrl,
    screenshotUrls: product.screenshotUrls,
    videoUrls: product.videoUrls,
    demoUrl: product.demoUrl,
    documentationUrl: product.documentationUrl,
    features: product.features,
    faqs: product.faqs,
    documentation: product.documentation,
    setupGuide: product.setupGuide,
    integrationCatalog: product.integrationCatalog,
    roadmap: product.roadmap,
    supportPlans: product.supportPlans,
    bundleOffers: product.bundleOffers,
    commerceConfig: product.commerceConfig,
    aiConfig: product.aiConfig,
    techStack: product.techStack,
    tags: product.tags,
    isPremium: product.isPremium,
    isFeatured: product.isFeatured,
    isTrending: product.isTrending,
    isBestSeller: product.isBestSeller,
    badgeText: product.badgeText,
    averageRating: product.averageRating,
    reviewCount: product._count.reviews,
    viewCount: product.viewCount,
    activeUsers: product._count.subscriptions,
    vendor: product.vendor ? {
      id: product.vendor.id,
      slug: product.vendor.slug,
      displayName: product.vendor.displayName,
      status: product.vendor.status,
      type: product.vendor.type,
      sellerScore: product.vendor.sellerScore,
      averageRating: product.vendor.averageRating,
      totalSales: product.vendor.totalSales,
      badges: product.vendor.badges,
      logoUrl: product.vendor.logoUrl,
    } : null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    tiers: product.tiers.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      price: Number(t.price),
      discountPrice: t.discountPrice ? Number(t.discountPrice) : null,
      flashSalePrice: t.flashSalePrice ? Number(t.flashSalePrice) : null,
      flashSaleEndsAt: t.flashSaleEndsAt ? t.flashSaleEndsAt.toISOString() : null,
      currency: t.currency,
      interval: t.interval,
      features: t.features as string[],
      limits: t.limits as Record<string, any> | null,
      trialDays: t.trialDays,
      isPopular: t.isPopular,
      isRecommended: t.isRecommended,
      isActive: t.isActive,
      maxSeats: t.maxSeats,
      usageUnit: t.usageUnit,
      setupFee: t.setupFee ? Number(t.setupFee) : null,
    })),
    reviews: product.reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      verifiedPurchase: r.verifiedPurchase,
      helpfulCount: r.helpfulCount,
      createdAt: r.createdAt.toISOString(),
      user: { name: r.user.name, avatarUrl: r.user.avatarUrl },
    })),
    versions: product.versions.map(v => ({
      id: v.id,
      version: v.version,
      createdAt: v.createdAt.toISOString(),
    })),
    campaign: campaign ? {
      id: campaign.id,
      bannerText: campaign.bannerText,
      ctaText: campaign.ctaText,
      discountPercent: campaign.discountPercent,
      endsAt: campaign.endsAt.toISOString(),
      flatDiscount: campaign.flatDiscount ? Number(campaign.flatDiscount) : null,
    } : null,
    related: related.map(r => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      type: r.type,
      thumbnailUrl: r.thumbnailUrl,
      averageRating: r.averageRating,
      startingPrice: r.tiers[0] ? Number(r.tiers[0].price) : null,
      interval: r.tiers[0]?.interval || null,
    })),
  }

  return <ProductDetailClient product={serialized} />
}
