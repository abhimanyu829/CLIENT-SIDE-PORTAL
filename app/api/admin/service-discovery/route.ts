import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { deliverServiceCampaign } from "@/lib/service-discovery"
import { slugify } from "@/lib/utils"

const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120), slug: z.string().trim().max(140).optional(), description: z.string().trim().max(1000).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "ARCHIVED", "COMPLETED"]).default("DRAFT"),
  placement: z.string().trim().min(1).max(80).default("services"), bannerUrl: z.string().optional().or(z.literal("")),
  thumbnailUrl: z.string().optional().or(z.literal("")), backgroundUrl: z.string().optional().or(z.literal("")), videoUrl: z.string().optional().or(z.literal("")),
  ctaLabel: z.string().trim().max(80).optional(), landingUrl: z.string().trim().max(500).optional(),
  startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional(), priority: z.number().int().min(-100).max(1000).default(0),
  targetAudience: z.record(z.unknown()).default({}), categorySlugs: z.array(z.string().max(80)).default([]),
  relatedServiceIds: z.array(z.string().cuid()).default([]), relatedProductIds: z.array(z.string().cuid()).default([]), tags: z.array(z.string().max(80)).default([]),
})
const collectionSchema = z.object({ name: z.string().trim().min(2).max(100), slug: z.string().trim().max(140).optional(), description: z.string().trim().max(500).optional(), placement: z.string().trim().min(1).max(80).default("services"), isActive: z.boolean().default(true), priority: z.number().int().min(-100).max(1000).default(0), audience: z.record(z.unknown()).default({}), serviceIds: z.array(z.string().cuid()).max(50).default([]) })
const tagSchema = z.object({ name: z.string().trim().min(2).max(80), slug: z.string().trim().max(100).optional(), description: z.string().trim().max(300).optional(), isFeatured: z.boolean().default(false), serviceIds: z.array(z.string().cuid()).max(100).default([]) })

async function admin() {
  const session = await auth()
  if (!session?.user?.id || !["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role)) throw new Error("FORBIDDEN")
  return session.user
}

function nullIfEmpty(value?: string) { return value?.trim() || null }
function inputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export async function GET() {
  try {
    await admin()
    const [campaigns, collections, tags, services, products] = await Promise.all([
      db.serviceDiscoveryCampaign.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] }),
      db.serviceDiscoveryCollection.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }], include: { items: { select: { servicePageId: true, sortOrder: true } } } }),
      db.serviceDiscoveryTag.findMany({ orderBy: [{ isFeatured: "desc" }, { name: "asc" }], include: { assignments: { select: { servicePageId: true } } } }),
      db.servicePage.findMany({ where: { isActive: true }, orderBy: { title: "asc" }, select: { id: true, title: true, slug: true, category: { select: { name: true, slug: true } } } }),
      db.product.findMany({ where: { status: "AVAILABLE" }, orderBy: { name: "asc" }, take: 100, select: { id: true, name: true, slug: true } }),
    ])
    return NextResponse.json({ success: true, data: { campaigns, collections, tags, services, products } })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error && error.message === "FORBIDDEN" ? "Forbidden" : "Unable to load service discovery" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const user = await admin()
    const body = await request.json()
    const entity = body?.entity
    if (entity === "campaign") {
      const input = campaignSchema.parse(body.data)
      const startsAt = input.startsAt ? new Date(input.startsAt) : null; const endsAt = input.endsAt ? new Date(input.endsAt) : null
      if (startsAt && endsAt && endsAt <= startsAt) return NextResponse.json({ success: false, error: "Campaign end must be after its start" }, { status: 422 })
      const campaign = await db.serviceDiscoveryCampaign.create({ data: { ...input, targetAudience: inputJson(input.targetAudience), slug: input.slug || slugify(input.name), description: nullIfEmpty(input.description), bannerUrl: nullIfEmpty(input.bannerUrl), thumbnailUrl: nullIfEmpty(input.thumbnailUrl), backgroundUrl: nullIfEmpty(input.backgroundUrl), videoUrl: nullIfEmpty(input.videoUrl), ctaLabel: nullIfEmpty(input.ctaLabel), landingUrl: nullIfEmpty(input.landingUrl), startsAt, endsAt, createdById: user.id } })
      return NextResponse.json({ success: true, data: campaign }, { status: 201 })
    }
    if (entity === "collection") {
      const input = collectionSchema.parse(body.data)
      const collection = await db.serviceDiscoveryCollection.create({ data: { name: input.name, slug: input.slug || slugify(input.name), description: nullIfEmpty(input.description), placement: input.placement, isActive: input.isActive, priority: input.priority, audience: inputJson(input.audience), createdById: user.id, items: { create: input.serviceIds.map((servicePageId, sortOrder) => ({ servicePageId, sortOrder })) } }, include: { items: true } })
      return NextResponse.json({ success: true, data: collection }, { status: 201 })
    }
    if (entity === "tag") {
      const input = tagSchema.parse(body.data)
      const tag = await db.serviceDiscoveryTag.create({ data: { name: input.name, slug: input.slug || slugify(input.name), description: nullIfEmpty(input.description), isFeatured: input.isFeatured, assignments: { create: input.serviceIds.map((servicePageId) => ({ servicePageId })) } }, include: { assignments: true } })
      return NextResponse.json({ success: true, data: tag }, { status: 201 })
    }
    return NextResponse.json({ success: false, error: "Unsupported discovery entity" }, { status: 422 })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof z.ZodError ? error.issues[0]?.message : "Unable to create discovery content" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 }) }
}

export async function PUT(request: NextRequest) {
  try {
    await admin()
    const body = await request.json()
    const entity = body?.entity
    const id = body?.id
    if (!id) return NextResponse.json({ success: false, error: "Campaign ID is required for edit" }, { status: 400 })

    if (entity === "campaign") {
      const input = campaignSchema.parse(body.data)
      const startsAt = input.startsAt ? new Date(input.startsAt) : null
      const endsAt = input.endsAt ? new Date(input.endsAt) : null
      if (startsAt && endsAt && endsAt <= startsAt) {
        return NextResponse.json({ success: false, error: "Campaign end must be after its start" }, { status: 422 })
      }
      const campaign = await db.serviceDiscoveryCampaign.update({
        where: { id },
        data: {
          ...input,
          targetAudience: inputJson(input.targetAudience),
          slug: input.slug || slugify(input.name),
          description: nullIfEmpty(input.description),
          bannerUrl: nullIfEmpty(input.bannerUrl),
          thumbnailUrl: nullIfEmpty(input.thumbnailUrl),
          backgroundUrl: nullIfEmpty(input.backgroundUrl),
          videoUrl: nullIfEmpty(input.videoUrl),
          ctaLabel: nullIfEmpty(input.ctaLabel),
          landingUrl: nullIfEmpty(input.landingUrl),
          startsAt,
          endsAt,
        },
      })
      return NextResponse.json({ success: true, data: campaign })
    }
    return NextResponse.json({ success: false, error: "Unsupported discovery entity" }, { status: 422 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof z.ZodError ? error.issues[0]?.message : "Unable to update discovery content" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 }
    )
  }
}
