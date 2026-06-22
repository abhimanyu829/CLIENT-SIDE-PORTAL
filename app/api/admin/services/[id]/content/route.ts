import { NextRequest, NextResponse } from "next/server"
import { ServiceDocumentType, ServiceMediaType } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

const baseSchema = z.object({
  type: z.enum(["feature", "technology", "faq", "portfolio", "plan", "addon", "media", "document"]),
  itemId: z.string().optional(),
  data: z.record(z.any()).default({}),
})

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean)
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean)
    }
  }
  return []
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeOptionalString(value: unknown) {
  if (value === undefined) return undefined
  if (value === null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function entityLabel(type: string) {
  return type[0].toUpperCase() + type.slice(1)
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed
    } catch {
      return {}
    }
  }
  return {}
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return mutateContent(req, params, "create")
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return mutateContent(req, params, "update")
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return mutateContent(req, params, "delete")
}

async function mutateContent(
  req: NextRequest,
  params: Promise<{ id: string }>,
  action: "create" | "update" | "delete"
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()
    const parsed = baseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const service = await db.servicePage.findUnique({ where: { id } })
    if (!service) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service not found" } }, { status: 404 })
    }

    const { type, itemId, data } = parsed.data
    let result: unknown = null
    let before: unknown = null

    if (action === "create") {
      if (type === "feature") {
        result = await db.serviceFeature.create({
          data: {
            servicePageId: id,
            title: String(data.title ?? "").trim(),
            description: String(data.description ?? "").trim(),
            icon: data.icon ? String(data.icon) : null,
            sortOrder: toNumber(data.sortOrder),
          },
        })
      } else if (type === "technology") {
        result = await db.serviceTechnology.create({
          data: {
            servicePageId: id,
            name: String(data.name ?? "").trim(),
            iconUrl: data.iconUrl ? String(data.iconUrl) : null,
            sortOrder: toNumber(data.sortOrder),
          },
        })
      } else if (type === "faq") {
        result = await db.serviceFaq.create({
          data: {
            servicePageId: id,
            question: String(data.question ?? "").trim(),
            answer: String(data.answer ?? "").trim(),
            sortOrder: toNumber(data.sortOrder),
          },
        })
      } else if (type === "portfolio") {
        result = await db.servicePortfolio.create({
          data: {
            servicePageId: id,
            title: String(data.title ?? "").trim(),
            description: String(data.description ?? "").trim(),
            imageUrl: data.imageUrl ? String(data.imageUrl) : null,
            projectUrl: data.projectUrl ? String(data.projectUrl) : null,
            results: parseJsonArray(data.results),
            sortOrder: toNumber(data.sortOrder),
          },
        })
      } else if (type === "plan") {
        result = await db.servicePlan.create({
          data: {
            servicePageId: id,
            type: data.planType === "ONE_TIME" ? "ONE_TIME" : "SUBSCRIPTION",
            name: String(data.name ?? "").trim(),
            billingLabel: normalizeOptionalString(data.billingLabel),
            price: toNumber(data.price),
            currency: String(data.currency ?? "USD").trim() || "USD",
            description: normalizeOptionalString(data.description),
            features: parseJsonArray(data.features),
            isPopular: Boolean(data.isPopular),
            isActive: data.isActive === undefined ? true : Boolean(data.isActive),
            sortOrder: toNumber(data.sortOrder),
          },
        })
      } else if (type === "addon") {
        result = await db.serviceAddon.create({
          data: {
            servicePageId: id,
            name: String(data.name ?? "").trim(),
            description: normalizeOptionalString(data.description),
            price: toNumber(data.price),
            currency: String(data.currency ?? "USD").trim() || "USD",
            enabled: data.enabled === undefined ? true : Boolean(data.enabled),
            bundleOnly: Boolean(data.bundleOnly),
            restricted: Boolean(data.restricted),
            isPopular: Boolean(data.isPopular),
            sortOrder: toNumber(data.sortOrder),
          },
        })
      } else if (type === "media") {
        result = await db.serviceMediaAsset.create({
          data: {
            servicePageId: id,
            mediaType: (String(data.mediaType ?? "SCREENSHOT") as ServiceMediaType),
            title: String(data.title ?? "").trim(),
            url: String(data.url ?? "").trim(),
            caption: normalizeOptionalString(data.caption),
            altText: normalizeOptionalString(data.altText),
            isActive: data.isActive === undefined ? true : Boolean(data.isActive),
            sortOrder: toNumber(data.sortOrder),
            metadata: parseJsonObject(data.metadata),
          },
        })
      } else if (type === "document") {
        result = await db.serviceDocument.create({
          data: {
            servicePageId: id,
            documentType: (String(data.documentType ?? "DOCUMENTATION") as ServiceDocumentType),
            title: String(data.title ?? "").trim(),
            slug: String(data.slug ?? "").trim(),
            summary: normalizeOptionalString(data.summary),
            content: normalizeOptionalString(data.content),
            previewUrl: normalizeOptionalString(data.previewUrl),
            demoUrl: normalizeOptionalString(data.demoUrl),
            version: String(data.version ?? "1.0").trim() || "1.0",
            isPublished: data.isPublished === undefined ? true : Boolean(data.isPublished),
            sortOrder: toNumber(data.sortOrder),
            metadata: parseJsonObject(data.metadata),
          },
        })
      }
    } else {
      if (!itemId) {
        return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "itemId is required" } }, { status: 422 })
      }

      if (type === "feature") {
        before = await db.serviceFeature.findFirst({ where: { id: itemId, servicePageId: id } })
        if (!before) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Feature not found" } }, { status: 404 })
        result = action === "delete"
          ? await db.serviceFeature.delete({ where: { id: itemId } })
          : await db.serviceFeature.update({
              where: { id: itemId },
              data: {
                title: data.title !== undefined ? String(data.title).trim() : undefined,
                description: data.description !== undefined ? String(data.description).trim() : undefined,
                icon: data.icon !== undefined ? (data.icon ? String(data.icon) : null) : undefined,
                sortOrder: data.sortOrder !== undefined ? toNumber(data.sortOrder) : undefined,
              },
            })
      } else if (type === "technology") {
        before = await db.serviceTechnology.findFirst({ where: { id: itemId, servicePageId: id } })
        if (!before) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Technology not found" } }, { status: 404 })
        result = action === "delete"
          ? await db.serviceTechnology.delete({ where: { id: itemId } })
          : await db.serviceTechnology.update({
              where: { id: itemId },
              data: {
                name: data.name !== undefined ? String(data.name).trim() : undefined,
                iconUrl: data.iconUrl !== undefined ? (data.iconUrl ? String(data.iconUrl) : null) : undefined,
                sortOrder: data.sortOrder !== undefined ? toNumber(data.sortOrder) : undefined,
              },
            })
      } else if (type === "faq") {
        before = await db.serviceFaq.findFirst({ where: { id: itemId, servicePageId: id } })
        if (!before) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "FAQ not found" } }, { status: 404 })
        result = action === "delete"
          ? await db.serviceFaq.delete({ where: { id: itemId } })
          : await db.serviceFaq.update({
              where: { id: itemId },
              data: {
                question: data.question !== undefined ? String(data.question).trim() : undefined,
                answer: data.answer !== undefined ? String(data.answer).trim() : undefined,
                sortOrder: data.sortOrder !== undefined ? toNumber(data.sortOrder) : undefined,
              },
            })
      } else if (type === "portfolio") {
        before = await db.servicePortfolio.findFirst({ where: { id: itemId, servicePageId: id } })
        if (!before) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Portfolio item not found" } }, { status: 404 })
        result = action === "delete"
          ? await db.servicePortfolio.delete({ where: { id: itemId } })
          : await db.servicePortfolio.update({
              where: { id: itemId },
              data: {
                title: data.title !== undefined ? String(data.title).trim() : undefined,
                description: data.description !== undefined ? String(data.description).trim() : undefined,
                imageUrl: data.imageUrl !== undefined ? (data.imageUrl ? String(data.imageUrl) : null) : undefined,
                projectUrl: data.projectUrl !== undefined ? (data.projectUrl ? String(data.projectUrl) : null) : undefined,
                results: data.results !== undefined ? parseJsonArray(data.results) : undefined,
                sortOrder: data.sortOrder !== undefined ? toNumber(data.sortOrder) : undefined,
              },
            })
      } else if (type === "plan") {
        before = await db.servicePlan.findFirst({ where: { id: itemId, servicePageId: id } })
        if (!before) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Plan not found" } }, { status: 404 })
        result = action === "delete"
          ? await db.servicePlan.delete({ where: { id: itemId } })
          : await db.servicePlan.update({
              where: { id: itemId },
              data: {
                type: data.planType !== undefined ? (data.planType === "ONE_TIME" ? "ONE_TIME" : "SUBSCRIPTION") : undefined,
                name: data.name !== undefined ? String(data.name).trim() : undefined,
                billingLabel: data.billingLabel !== undefined ? normalizeOptionalString(data.billingLabel) : undefined,
                price: data.price !== undefined ? toNumber(data.price) : undefined,
                currency: data.currency !== undefined ? String(data.currency).trim() : undefined,
                description: data.description !== undefined ? normalizeOptionalString(data.description) : undefined,
                features: data.features !== undefined ? parseJsonArray(data.features) : undefined,
                isPopular: data.isPopular !== undefined ? Boolean(data.isPopular) : undefined,
                isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
                sortOrder: data.sortOrder !== undefined ? toNumber(data.sortOrder) : undefined,
              },
            })
      } else if (type === "addon") {
        before = await db.serviceAddon.findFirst({ where: { id: itemId, servicePageId: id } })
        if (!before) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Addon not found" } }, { status: 404 })
        result = action === "delete"
          ? await db.serviceAddon.delete({ where: { id: itemId } })
          : await db.serviceAddon.update({
              where: { id: itemId },
              data: {
                name: data.name !== undefined ? String(data.name).trim() : undefined,
                description: data.description !== undefined ? normalizeOptionalString(data.description) : undefined,
                price: data.price !== undefined ? toNumber(data.price) : undefined,
                currency: data.currency !== undefined ? String(data.currency).trim() : undefined,
                enabled: data.enabled !== undefined ? Boolean(data.enabled) : undefined,
                bundleOnly: data.bundleOnly !== undefined ? Boolean(data.bundleOnly) : undefined,
                restricted: data.restricted !== undefined ? Boolean(data.restricted) : undefined,
                isPopular: data.isPopular !== undefined ? Boolean(data.isPopular) : undefined,
                sortOrder: data.sortOrder !== undefined ? toNumber(data.sortOrder) : undefined,
              },
            })
      } else if (type === "media") {
        before = await db.serviceMediaAsset.findFirst({ where: { id: itemId, servicePageId: id } })
        if (!before) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Media asset not found" } }, { status: 404 })
        result = action === "delete"
          ? await db.serviceMediaAsset.delete({ where: { id: itemId } })
          : await db.serviceMediaAsset.update({
              where: { id: itemId },
              data: {
                mediaType: data.mediaType !== undefined ? (String(data.mediaType) as ServiceMediaType) : undefined,
                title: data.title !== undefined ? String(data.title).trim() : undefined,
                url: data.url !== undefined ? String(data.url).trim() : undefined,
                caption: data.caption !== undefined ? normalizeOptionalString(data.caption) : undefined,
                altText: data.altText !== undefined ? normalizeOptionalString(data.altText) : undefined,
                isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
                sortOrder: data.sortOrder !== undefined ? toNumber(data.sortOrder) : undefined,
                metadata: data.metadata !== undefined ? parseJsonObject(data.metadata) : undefined,
              },
            })
      } else if (type === "document") {
        before = await db.serviceDocument.findFirst({ where: { id: itemId, servicePageId: id } })
        if (!before) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 })
        result = action === "delete"
          ? await db.serviceDocument.delete({ where: { id: itemId } })
          : await db.serviceDocument.update({
              where: { id: itemId },
              data: {
                documentType: data.documentType !== undefined ? (String(data.documentType) as ServiceDocumentType) : undefined,
                title: data.title !== undefined ? String(data.title).trim() : undefined,
                slug: data.slug !== undefined ? String(data.slug).trim() : undefined,
                summary: data.summary !== undefined ? normalizeOptionalString(data.summary) : undefined,
                content: data.content !== undefined ? normalizeOptionalString(data.content) : undefined,
                previewUrl: data.previewUrl !== undefined ? normalizeOptionalString(data.previewUrl) : undefined,
                demoUrl: data.demoUrl !== undefined ? normalizeOptionalString(data.demoUrl) : undefined,
                version: data.version !== undefined ? String(data.version).trim() || "1.0" : undefined,
                isPublished: data.isPublished !== undefined ? Boolean(data.isPublished) : undefined,
                sortOrder: data.sortOrder !== undefined ? toNumber(data.sortOrder) : undefined,
                metadata: data.metadata !== undefined ? parseJsonObject(data.metadata) : undefined,
              },
            })
      }
    }

    await auditLog({
      userId: session.user.id,
      action: `service_content.${action}`,
      entity: entityLabel(type),
      entityId: action === "create" ? (result as any)?.id : itemId!,
      before: before ? (before as Record<string, unknown>) : undefined,
      after: action === "delete" ? undefined : (result as Record<string, unknown>),
    })

    return NextResponse.json({ success: true, data: result }, { status: action === "create" ? 201 : 200 })
  } catch (error) {
    logger.error({ error }, "POST/PUT/DELETE /api/admin/services/[id]/content")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
