import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { nanoid } from "nanoid"

const createCouponSchema = z.object({
  code: z.string().min(3).max(30).toUpperCase().optional(),
  type: z.enum(["PERCENTAGE", "FLAT"]),
  discountValue: z.number().positive(),
  currency: z.string().length(3).optional(),
  maxUses: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().default(1),
  expiresAt: z.string().datetime().optional(),
  minCartValue: z.number().nonnegative().optional(),
  applicableTierIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
})

const bulkGenerateSchema = z.object({
  prefix: z.string().min(2).max(10).toUpperCase(),
  count: z.number().int().min(1).max(1000),
  config: createCouponSchema.omit({ code: true }),
})

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
})

function isAdmin(session: any): boolean {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

// GET /api/admin/coupons — list with pagination + search
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const { page, limit, search } = paginationSchema.parse(Object.fromEntries(searchParams))
    const skip = (page - 1) * limit

    const where = search ? { code: { contains: search.toUpperCase() } } : {}

    const [coupons, total] = await Promise.all([
      db.coupon.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      db.coupon.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: coupons,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    logger.error({ error }, "GET /api/admin/coupons")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

// POST /api/admin/coupons — create single coupon
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()

    // Bulk generate path
    if (body.bulk === true) {
      const parsed = bulkGenerateSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid bulk config", details: parsed.error.flatten() } },
          { status: 422 }
        )
      }
      const { prefix, count, config } = parsed.data

      const codes = Array.from({ length: count }, () => `${prefix}-${nanoid(6).toUpperCase()}`)

      await db.coupon.createMany({
        data: codes.map((code) => ({
          code,
          type: config.type,
          discountValue: config.discountValue,
          currency: config.currency,
          maxUses: config.maxUses,
          expiresAt: config.expiresAt ? new Date(config.expiresAt) : null,
          applicableTierIds: config.applicableTierIds,
          isActive: config.isActive,
        })),
        skipDuplicates: true,
      })

      await auditLog({
        userId: session.user.id,
        action: "coupon.bulk_generate",
        entity: "Coupon",
        after: { prefix, count, type: config.type },
      })

      return NextResponse.json({ success: true, data: { generated: count, codes } }, { status: 201 })
    }

    // Single coupon path
    const parsed = createCouponSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const data = parsed.data
    const code = data.code ?? `COUPON-${nanoid(8).toUpperCase()}`

    // Check uniqueness
    const existing = await db.coupon.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: `Coupon code '${code}' already exists` } },
        { status: 409 }
      )
    }

    const coupon = await db.coupon.create({
      data: {
        code,
        type: data.type,
        discountValue: data.discountValue,
        currency: data.currency,
        maxUses: data.maxUses,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        applicableTierIds: data.applicableTierIds,
        isActive: data.isActive,
      },
    })

    await auditLog({
      userId: session.user.id,
      action: "coupon.create",
      entity: "Coupon",
      entityId: coupon.id,
      after: coupon,
    })

    return NextResponse.json({ success: true, data: coupon }, { status: 201 })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/coupons")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
