import { OrderStatus, Prisma, ServiceCampaignEventType, ServiceCampaignStatus, ServiceDiscoveryEventType } from "@prisma/client"
import { db } from "@/lib/db"
import { enqueueEmail } from "@/lib/email/service"
import { createNotification } from "@/lib/notifications"

const SERVICE_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  heroSubheading: true,
  heroImageUrl: true,
  category: { select: { slug: true, name: true } },
  discoveryTags: { select: { tag: { select: { slug: true, name: true } } } },
} satisfies Prisma.ServicePageSelect

export type DiscoveryService = Prisma.ServicePageGetPayload<{ select: typeof SERVICE_CARD_SELECT }>

function scoreMap(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, number>) }
    : {} as Record<string, number>
}

function publicService(service: DiscoveryService) {
  return {
    id: service.id,
    slug: service.slug,
    title: service.title,
    description: service.heroSubheading,
    imageUrl: service.heroImageUrl,
    category: service.category,
    tags: service.discoveryTags.map((entry) => entry.tag),
  }
}

export function campaignIsLive(campaign: { status: ServiceCampaignStatus; startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  return campaign.status === "ACTIVE"
    && (!campaign.startsAt || campaign.startsAt <= now)
    && (!campaign.endsAt || campaign.endsAt >= now)
}

export interface ExtendedUser {
  id: string
  email?: string
  name?: string | null
  role: string
  createdAt: Date
  hasPurchased?: boolean
  purchaseCount?: number
}

/**
 * Determines if a campaign's targetAudience rules match the given user.
 * Supports the full targeting schema:
 *   visitorType, pages, roles, hasPurchased, minPurchaseCount, userStates (legacy)
 */
export function targetMatches(
  target: Prisma.JsonValue,
  user: ExtendedUser | null,
) {
  const config =
    target && typeof target === "object" && !Array.isArray(target)
      ? (target as Record<string, unknown>)
      : {}

  // ── visitorType targeting ────────────────────────────────────────
  const visitorType = typeof config.visitorType === "string" ? config.visitorType : "all"
  if (visitorType !== "all") {
    const isGuest = !user
    const hasPurchased = user?.hasPurchased ?? false
    if (visitorType === "guest" && !isGuest) return false
    if (visitorType === "logged_in" && isGuest) return false
    if (visitorType === "paid_customer" && (isGuest || !hasPurchased)) return false
    if (visitorType === "free_user" && (isGuest || hasPurchased)) return false
  }

  // ── Role targeting ───────────────────────────────────────────────
  const roles = Array.isArray(config.roles)
    ? config.roles.filter((item): item is string => typeof item === "string")
    : []
  if (roles.length > 0 && (!user || !roles.includes(user.role))) return false

  // ── Purchase history targeting ───────────────────────────────────
  const hpTarget =
    typeof config.hasPurchased === "boolean" ? config.hasPurchased : null
  if (hpTarget === true && !(user?.hasPurchased)) return false
  if (hpTarget === false && user?.hasPurchased) return false

  const minPurchaseCount =
    typeof config.minPurchaseCount === "number" ? config.minPurchaseCount : 0
  if (minPurchaseCount > 0 && (user?.purchaseCount ?? 0) < minPurchaseCount) return false

  // ── Legacy userStates targeting ──────────────────────────────────
  const userStates = Array.isArray(config.userStates)
    ? config.userStates.filter((item): item is string => typeof item === "string")
    : []
  if (userStates.length > 0) {
    if (!user) return false
    const isNew = Date.now() - user.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000
    if (isNew && !userStates.includes("new")) return false
    if (!isNew && !userStates.includes("returning")) return false
  }

  return true
}

export async function getServiceDiscovery(userId?: string | null, placement = "services") {
  const user = userId
    ? await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, createdAt: true } })
    : null
  const now = new Date()
  const [campaigns, collections, recentlyAdded, featured, profile, trendingRows] = await Promise.all([
    db.serviceDiscoveryCampaign.findMany({
      where: { placement, status: "ACTIVE" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
    db.serviceDiscoveryCollection.findMany({
      where: { placement, isActive: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        items: { orderBy: { sortOrder: "asc" }, include: { servicePage: { select: SERVICE_CARD_SELECT } }, take: 12 },
      },
      take: 16,
    }),
    db.servicePage.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 8, select: SERVICE_CARD_SELECT }),
    db.servicePage.findMany({
      where: { isActive: true, discoveryTags: { some: { tag: { isFeatured: true } } } },
      orderBy: { updatedAt: "desc" }, take: 8, select: SERVICE_CARD_SELECT,
    }),
    userId ? db.serviceInterestProfile.findUnique({ where: { userId } }) : null,
    db.serviceDiscoveryEvent.groupBy({
      by: ["servicePageId"],
      where: { servicePageId: { not: null }, eventType: { in: ["VIEW", "CLICK"] }, occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: { _all: true }, orderBy: { _count: { servicePageId: "desc" } }, take: 8,
    }),
  ])

  const trendingIds = trendingRows.map((item) => item.servicePageId).filter((id): id is string => !!id)
  const trending = trendingIds.length
    ? await db.servicePage.findMany({ where: { id: { in: trendingIds }, isActive: true }, select: SERVICE_CARD_SELECT })
    : []
  const byId = new Map(trending.map((item) => [item.id, item]))

  const categoryScores = scoreMap(profile?.categoryScores)
  const tagScores = scoreMap(profile?.tagScores)
  const candidateServices = userId && (Object.keys(categoryScores).length || Object.keys(tagScores).length)
    ? await db.servicePage.findMany({ where: { isActive: true }, select: SERVICE_CARD_SELECT, take: 100 })
    : []
  const recommended = candidateServices
    .map((service) => ({
      service,
      score: (service.category ? (categoryScores[service.category.slug] ?? 0) : 0)
        + service.discoveryTags.reduce((sum, entry) => sum + (tagScores[entry.tag.slug] ?? 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map((entry) => entry.service)

  return {
    campaigns: campaigns
      .filter((campaign) => campaignIsLive(campaign, now) && targetMatches(campaign.targetAudience, user))
      .map((campaign) => ({
        id: campaign.id, slug: campaign.slug, name: campaign.name, description: campaign.description,
        bannerUrl: campaign.bannerUrl, backgroundUrl: campaign.backgroundUrl, videoUrl: campaign.videoUrl,
        ctaLabel: campaign.ctaLabel, landingUrl: campaign.landingUrl, tags: campaign.tags,
      })),
    collections: collections
      .filter((collection) => targetMatches(collection.audience, user))
      .map((collection) => ({ id: collection.id, slug: collection.slug, name: collection.name, description: collection.description, services: collection.items.map((item) => publicService(item.servicePage)) })),
    sections: [
      { key: "recommended", title: "Recommended For You", services: recommended.map(publicService) },
      { key: "trending", title: "Trending Services", services: trendingIds.map((id) => byId.get(id)).filter((item): item is DiscoveryService => !!item).map(publicService) },
      { key: "featured", title: "Editor's Choice", services: featured.map(publicService) },
      { key: "recent", title: "Recently Added", services: recentlyAdded.map(publicService) },
    ].filter((section) => section.services.length > 0),
  }
}

export async function recordServiceDiscoveryEvent(input: {
  userId?: string | null
  sessionKey?: string | null
  servicePageId?: string | null
  eventType: ServiceDiscoveryEventType
  query?: string | null
  metadata?: Record<string, unknown>
}) {
  const event = await db.serviceDiscoveryEvent.create({
    data: {
      userId: input.userId ?? null, sessionKey: input.sessionKey ?? null, servicePageId: input.servicePageId ?? null,
      eventType: input.eventType, query: input.query ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  })

  if (!input.userId || !input.servicePageId) return event
  const service = await db.servicePage.findUnique({
    where: { id: input.servicePageId },
    select: { category: { select: { slug: true } }, discoveryTags: { select: { tag: { select: { slug: true } } } } },
  })
  if (!service) return event

  const weight = input.eventType === "PURCHASE_SIGNAL" ? 8 : input.eventType === "CART_SIGNAL" || input.eventType === "WISHLIST_SIGNAL" ? 4 : input.eventType === "CLICK" ? 2 : 1
  const current = await db.serviceInterestProfile.findUnique({ where: { userId: input.userId } })
  const categoryScores = scoreMap(current?.categoryScores)
  const tagScores = scoreMap(current?.tagScores)
  if (service.category) categoryScores[service.category.slug] = (categoryScores[service.category.slug] ?? 0) + weight
  for (const entry of service.discoveryTags) tagScores[entry.tag.slug] = (tagScores[entry.tag.slug] ?? 0) + weight
  await db.serviceInterestProfile.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, categoryScores, tagScores },
    update: { categoryScores, tagScores },
  })
  return event
}

export async function recordServiceCampaignEvent(input: {
  campaignId: string
  eventType: ServiceCampaignEventType
  userId?: string | null
  sessionKey?: string | null
  servicePageId?: string | null
  value?: number | null
}) {
  return db.serviceCampaignEvent.create({
    data: {
      campaignId: input.campaignId, eventType: input.eventType, userId: input.userId ?? null,
      sessionKey: input.sessionKey ?? null, servicePageId: input.servicePageId ?? null, value: input.value ?? null,
    },
  })
}

export async function deliverServiceCampaign(campaignId: string, actorId: string) {
  const campaign = await db.serviceDiscoveryCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND")

  // Read email delivery config from targetAudience
  const ta = campaign.targetAudience && typeof campaign.targetAudience === "object" && !Array.isArray(campaign.targetAudience)
    ? (campaign.targetAudience as Record<string, unknown>)
    : {}
  const emailConfig = ta.emailDelivery && typeof ta.emailDelivery === "object" && !Array.isArray(ta.emailDelivery)
    ? (ta.emailDelivery as Record<string, unknown>)
    : {}
  const emailEnabled = emailConfig.enabled !== false
  const emailSubject = typeof emailConfig.subject === "string" && emailConfig.subject ? emailConfig.subject : campaign.name
  const emailSegment = typeof emailConfig.segment === "string" ? emailConfig.segment : "all"

  // Build user query based on email segment
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const PAID_STATUSES: OrderStatus[] = [OrderStatus.PAID, OrderStatus.FULFILLED]

  const baseWhere =
    emailSegment === "paid"
      ? { orders: { some: { status: { in: PAID_STATUSES } } } }
      : emailSegment === "free"
      ? { orders: { none: { status: { in: PAID_STATUSES } } } }
      : emailSegment === "inactive"
      ? { updatedAt: { lt: thirtyDaysAgo } }
      : emailSegment === "new"
      ? { createdAt: { gte: sevenDaysAgo } }
      : {}

  const rawUsers = await db.user.findMany({
    where: baseWhere,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  })

  // Augment with purchase data for targetMatches
  const userIds = rawUsers.map((u) => u.id)
  const purchaseCounts = await db.order.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, status: { in: PAID_STATUSES } },
    _count: { _all: true },
  })
  const pcMap = Object.fromEntries(purchaseCounts.map((r) => [r.userId, r._count._all ?? 0]))

  const enrichedUsers: ExtendedUser[] = rawUsers.map((u) => ({
    ...u,
    name: u.name ?? null,
    purchaseCount: pcMap[u.id] ?? 0,
    hasPurchased: (pcMap[u.id] ?? 0) > 0,
  }))

  const recipients = enrichedUsers.filter((user) => targetMatches(campaign.targetAudience, user))

  await Promise.all(recipients.map(async (user) => {
    await createNotification({
      userId: user.id, type: "SYSTEM", title: campaign.name,
      body: campaign.description ?? "A new service campaign is available.",
      actionUrl: campaign.landingUrl ?? "/services",
      metadata: { source: "service-discovery", campaignId: campaign.id },
    }).catch(() => null)

    if (emailEnabled) {
      if (!user.email) return
      await enqueueEmail({
        emailType: "PROMOTIONAL_CAMPAIGN",
        recipient: user.email,
        subject: emailSubject,
        templateName: "communication",
        payload: {
          name: user.name,
          title: campaign.name,
          message: campaign.description ?? "Explore our latest service offering.",
          ctaLabel: campaign.ctaLabel ?? "Explore services",
          ctaUrl: campaign.landingUrl ?? "/services",
        },
        userId: user.id,
        queueNow: false,
      }).catch(() => null)
    }
  }))

  await db.serviceDiscoveryCampaign.update({ where: { id: campaignId }, data: { status: "ACTIVE" } })
  return { recipientCount: recipients.length, deliveredBy: actorId, emailSegment, emailEnabled }
}
