import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { logger } from "@/lib/logger"

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(2000),
})

// GET /api/products/[slug]/reviews — paginated public list
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const { searchParams } = _req.nextUrl

  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 10)))
  const skip = (page - 1) * limit

  try {
    const product = await db.product.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      )
    }

    const [reviews, total] = await Promise.all([
      db.productReview.findMany({
        where: { productId: product.id, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      db.productReview.count({
        where: { productId: product.id, status: "APPROVED" },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error({ error }, "GET /api/products/[slug]/reviews")
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    )
  }
}

// POST /api/products/[slug]/reviews — authenticated, one review per user per product
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      )
    }

    // Resolve product by slug
    const product = await db.product.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      )
    }

    const body = await req.json()
    const parsed = createReviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      )
    }

    const { rating, title, body: reviewBody } = parsed.data

    // Check if user already reviewed this product
    const existing = await db.productReview.findUnique({
      where: { productId_userId: { productId: product.id, userId: session.user.id } },
    })
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "You have already reviewed this product" } },
        { status: 409 }
      )
    }

    // Check for verified purchase (active or trialing subscription to this product)
    const subscription = await db.subscription.findFirst({
      where: {
        userId: session.user.id,
        productId: product.id,
        status: { in: ["ACTIVE", "TRIALING"] },
      },
    })

    const review = await db.productReview.create({
      data: {
        productId: product.id,
        userId: session.user.id,
        rating,
        title,
        body: reviewBody,
        verifiedPurchase: !!subscription,
        status: "PENDING", // goes to moderation queue
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    // Update product average rating (only count APPROVED reviews)
    const agg = await db.productReview.aggregate({
      where: { productId: product.id, status: "APPROVED" },
      _avg: { rating: true },
      _count: true,
    })
    await db.product.update({
      where: { id: product.id },
      data: {
        averageRating: agg._avg.rating ?? 0,
        reviewCount: agg._count,
      },
    })

    return NextResponse.json({ success: true, data: review }, { status: 201 })
  } catch (error) {
    logger.error({ error }, "POST /api/products/[slug]/reviews")
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    )
  }
}
