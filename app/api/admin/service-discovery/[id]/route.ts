import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { deliverServiceCampaign } from "@/lib/service-discovery"

async function admin() { const session = await auth(); if (!session?.user?.id || !["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role)) throw new Error("FORBIDDEN"); return session.user }
function jsonValue(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await admin(); const { id } = await params; const body = await request.json(); const entity = body?.entity
    if (entity === "campaign" && body.action === "deliver") return NextResponse.json({ success: true, data: await deliverServiceCampaign(id, user.id) })
    if (entity === "campaign" && body.action === "clone") {
      const source = await db.serviceDiscoveryCampaign.findUnique({ where: { id } }); if (!source) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
      const clone = await db.serviceDiscoveryCampaign.create({
        data: {
          name: `${source.name} copy`,
          slug: `${source.slug}-copy-${Date.now()}`,
          description: source.description,
          status: "DRAFT",
          placement: source.placement,
          bannerUrl: source.bannerUrl,
          thumbnailUrl: source.thumbnailUrl,
          backgroundUrl: source.backgroundUrl,
          videoUrl: source.videoUrl,
          ctaLabel: source.ctaLabel,
          landingUrl: source.landingUrl,
          startsAt: source.startsAt,
          endsAt: source.endsAt,
          priority: source.priority,
          targetAudience: jsonValue(source.targetAudience),
          categorySlugs: source.categorySlugs,
          relatedServiceIds: source.relatedServiceIds,
          relatedProductIds: source.relatedProductIds,
          tags: source.tags,
          createdById: user.id,
          archivedAt: null,
        },
      })
      return NextResponse.json({ success: true, data: clone })
    }
    const data = body?.data ?? {}
    if (entity === "campaign") return NextResponse.json({ success: true, data: await db.serviceDiscoveryCampaign.update({ where: { id }, data }) })
    if (entity === "collection") {
      const serviceIds: string[] | undefined = Array.isArray(data.serviceIds) ? data.serviceIds : undefined
      const updated = await db.$transaction(async (tx) => {
        if (serviceIds) await tx.serviceDiscoveryCollectionItem.deleteMany({ where: { collectionId: id } })
        return tx.serviceDiscoveryCollection.update({ where: { id }, data: { ...data, serviceIds: undefined, ...(serviceIds ? { items: { create: serviceIds.map((servicePageId, sortOrder) => ({ servicePageId, sortOrder })) } } : {}) }, include: { items: true } })
      })
      return NextResponse.json({ success: true, data: updated })
    }
    if (entity === "tag") {
      const serviceIds: string[] | undefined = Array.isArray(data.serviceIds) ? data.serviceIds : undefined
      const updated = await db.$transaction(async (tx) => {
        if (serviceIds) await tx.serviceDiscoveryTagAssignment.deleteMany({ where: { tagId: id } })
        return tx.serviceDiscoveryTag.update({ where: { id }, data: { ...data, serviceIds: undefined, ...(serviceIds ? { assignments: { create: serviceIds.map((servicePageId) => ({ servicePageId })) } } : {}) }, include: { assignments: true } })
      })
      return NextResponse.json({ success: true, data: updated })
    }
    return NextResponse.json({ success: false, error: "Unsupported discovery entity" }, { status: 422 })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error && error.message === "FORBIDDEN" ? "Forbidden" : "Unable to update discovery content" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 }) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await admin(); const { id } = await params; const entity = request.nextUrl.searchParams.get("entity")
    if (entity === "campaign") await db.serviceDiscoveryCampaign.delete({ where: { id } })
    else if (entity === "collection") await db.serviceDiscoveryCollection.delete({ where: { id } })
    else if (entity === "tag") await db.serviceDiscoveryTag.delete({ where: { id } })
    else return NextResponse.json({ success: false, error: "Unsupported discovery entity" }, { status: 422 })
    return NextResponse.json({ success: true })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error && error.message === "FORBIDDEN" ? "Forbidden" : "Unable to delete discovery content" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 }) }
}
