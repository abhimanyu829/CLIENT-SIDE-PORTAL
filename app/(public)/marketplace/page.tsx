import { db } from "@/lib/db"
import { ProductStatus, ProductType, CampaignStatus } from "@prisma/client"
import { unstable_cache } from "next/cache"
import OfferBanner from "@/components/marketplace/OfferBanner"
import MarketplaceClient from "./MarketplaceClient"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { StatsRow } from "@/components/public/StatsRow"
import { FAQSection } from "@/components/public/FAQSection"
import { CallToAction } from "@/components/public/CallToAction"
import { Shield, Zap, Globe, Lock, Cpu, BarChart } from "lucide-react"

export const revalidate = 30

export async function generateMetadata() {
  const count = await db.product.count({ where: { status: ProductStatus.AVAILABLE } }).catch(() => 0)
  return {
    title: `${count} Products — NexusAI Marketplace | AI Agents, SaaS Tools & More`,
    description: `Browse ${count}+ premium AI agents, SaaS tools, automation workflows, APIs, and developer products. Filter, compare, and deploy instantly.`,
    openGraph: {
      title: `${count} Products — NexusAI Marketplace`,
      description: `Browse and deploy ${count}+ AI products instantly`,
    },
  }
}

const getMarketplaceData = unstable_cache(async () => {
  const now = new Date()
  const [featured, trending, flashSale, bestSellers, allProducts, campaign, totalCount] = await Promise.all([
    // Featured products
    db.product.findMany({
      where: { status: ProductStatus.AVAILABLE, isFeatured: true },
      include: { tiers: { orderBy: { price: "asc" }, take: 1 }, _count: { select: { subscriptions: true } } },
      orderBy: { viewCount: "desc" },
      take: 6,
    }),
    // Trending
    db.product.findMany({
      where: { status: ProductStatus.AVAILABLE, isTrending: true },
      include: { tiers: { orderBy: { price: "asc" }, take: 1 }, _count: { select: { subscriptions: true } } },
      orderBy: { viewCount: "desc" },
      take: 8,
    }),
    // Flash sale (has flashSalePrice and endsAt in future)
    db.product.findMany({
      where: {
        status: ProductStatus.AVAILABLE,
        tiers: { some: { flashSalePrice: { not: null }, flashSaleEndsAt: { gt: now } } },
      },
      include: { tiers: { where: { flashSaleEndsAt: { gt: now } }, orderBy: { price: "asc" }, take: 1 }, _count: { select: { subscriptions: true } } },
      take: 4,
    }),
    // Best sellers
    db.product.findMany({
      where: { status: ProductStatus.AVAILABLE, isBestSeller: true },
      include: { tiers: { orderBy: { price: "asc" }, take: 1 }, _count: { select: { subscriptions: true } } },
      orderBy: [{ reviewCount: "desc" }, { averageRating: "desc" }],
      take: 4,
    }),
    // All products for main grid (first page)
    db.product.findMany({
      where: { status: ProductStatus.AVAILABLE },
      include: { tiers: { orderBy: { price: "asc" }, take: 1 }, _count: { select: { subscriptions: true } } },
      orderBy: [{ isFeatured: "desc" }, { viewCount: "desc" }],
      take: 24,
    }),
    // Active campaign
    db.campaign.findFirst({
      where: { status: CampaignStatus.ACTIVE, startsAt: { lte: now }, endsAt: { gte: now } },
      select: { id: true, bannerText: true, ctaText: true, ctaUrl: true, bannerImageUrl: true, endsAt: true, discountPercent: true, type: true },
    }),
    // Total count
    db.product.count({ where: { status: ProductStatus.AVAILABLE } }),
  ])

  return { featured, trending, flashSale, bestSellers, allProducts, campaign, totalCount }
}, ["marketplace-data"], { revalidate: 30, tags: ["products", "campaigns", "featured-products", "trending"] })

function toIso(value: Date | string | null | undefined) {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function serialize(products: any[]) {
  return products.map(p => {
    const tier = p.tiers?.[0]
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      type: p.type,
      category: p.category,
      thumbnailUrl: p.thumbnailUrl,
      iconUrl: p.iconUrl,
      isPremium: p.isPremium,
      isFeatured: p.isFeatured,
      isTrending: p.isTrending,
      isBestSeller: p.isBestSeller,
      badgeText: p.badgeText,
      averageRating: p.averageRating,
      reviewCount: p.reviewCount,
      viewCount: p.viewCount,
      tags: p.tags,
      demoUrl: p.demoUrl,
      previewEnabled: p.previewEnabled ?? false,
      previewConfig: p.previewConfig ?? {},
      inventoryEnabled: p.inventoryEnabled ?? false,
      inventoryCount: p.inventoryCount ?? 0,
      activeUsers: p._count?.subscriptions ?? 0,
      createdAt: toIso(p.createdAt),
      tierId: tier?.id,
      startingPrice: tier ? Number(tier.price) : undefined,
      discountPrice: tier?.discountPrice ? Number(tier.discountPrice) : undefined,
      flashSalePrice: tier?.flashSalePrice ? Number(tier.flashSalePrice) : undefined,
      flashSaleEndsAt: toIso(tier?.flashSaleEndsAt),
      currency: tier?.currency,
      interval: tier?.interval,
    }
  })
}

export default async function MarketplacePage() {
  const { featured, trending, flashSale, bestSellers, allProducts, campaign, totalCount } = await getMarketplaceData()

  const campaignData = campaign ? {
    id: campaign.id,
    bannerText: campaign.bannerText,
    ctaText: campaign.ctaText,
    ctaUrl: campaign.ctaUrl,
    bannerImageUrl: campaign.bannerImageUrl,
    endsAt: toIso(campaign.endsAt) ?? new Date().toISOString(),
    discountPercent: campaign.discountPercent,
    type: campaign.type,
  } : null

  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title={<>The Enterprise <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">AI Marketplace</span></>}
        description="Discover, deploy, and scale production-grade AI agents, SaaS tools, and developer APIs in seconds. The trusted ecosystem for modern AI infrastructure."
        pillText="NexusAI Ecosystem"
        ctaText="Start Deploying"
        ctaHref="/register"
        secondaryCtaText="View Documentation"
        secondaryCtaHref="/docs"
      />
      <OfferBanner campaign={campaignData} />
      <MarketplaceClient
        featured={serialize(featured)}
        trending={serialize(trending)}
        flashSale={serialize(flashSale)}
        bestSellers={serialize(bestSellers)}
        allProducts={serialize(allProducts)}
        totalCount={totalCount}
      />
      
      <StatsRow stats={[
        { value: "10k+", label: "Active Deployments" },
        { value: "99.99%", label: "Platform Uptime" },
        { value: "500+", label: "Verified Agents" },
        { value: "0ms", label: "Cold Starts" }
      ]} />

      <FeatureGrid 
        title="Why Choose NexusAI Marketplace?"
        description="Built for enterprise scale, security, and instant deployment."
        features={[
          { icon: Shield, title: "Enterprise Security", description: "All products undergo rigorous security audits, penetration testing, and compliance checks before listing." },
          { icon: Zap, title: "Instant Deployment", description: "Deploy AI agents and SaaS tools to your dedicated cloud environment with a single click." },
          { icon: Globe, title: "Global Edge Network", description: "Low-latency API access and CDN distribution ensures your tools run lightning fast worldwide." },
          { icon: Lock, title: "Data Privacy", description: "SOC2 Type II compliance and strict data isolation ensures your sensitive IP remains protected." },
          { icon: Cpu, title: "Model Agnostic", description: "Seamlessly switch between GPT-4, Claude 3, and Llama 3 across all your deployed AI agents." },
          { icon: BarChart, title: "Unified Analytics", description: "Monitor usage, costs, and performance across all your third-party SaaS tools in one dashboard." }
        ]}
      />

      <FAQSection 
        title="Marketplace FAQs"
        faqs={[
          { question: "How are products vetted before listing?", answer: "Every product undergoes a 4-step manual review process including security auditing, code scanning, performance benchmarking, and creator identity verification." },
          { question: "Can I sell my own AI agents?", answer: "Yes! Developers can monetize their AI agents and SaaS tools by listing them on the NexusAI Marketplace. We handle billing, authentication, and hosting." },
          { question: "Are subscriptions managed in one place?", answer: "Yes, all marketplace subscriptions are centralized in your NexusAI dashboard with unified billing and usage limits." },
          { question: "What is the refund policy?", answer: "We offer a 14-day money-back guarantee on all premium SaaS tools and AI agents if they don't meet your expectations." }
        ]}
      />

      <CallToAction 
        title="Ready to upgrade your workflow?"
        description="Join thousands of companies using NexusAI to deploy enterprise-grade AI tools."
        ctaText="Explore All Products"
        ctaHref="/register"
      />
    </div>
  )
}
