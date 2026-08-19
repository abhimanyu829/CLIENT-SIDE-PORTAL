import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { z } from "zod"

const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(2).max(120),
  body: z.string().min(5).max(2000),
  productId: z.string().optional(),
  authorName: z.string().optional(),
  authorRole: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const ratingFilter = searchParams.get("rating")
    const productId = searchParams.get("productId")
    const search = searchParams.get("search")

    const whereClause: any = {
      status: "APPROVED",
    }

    if (ratingFilter && ratingFilter !== "ALL") {
      whereClause.rating = Number(ratingFilter)
    }

    if (productId && productId !== "ALL") {
      whereClause.productId = productId
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ]
    }

    const reviews = await db.productReview.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    })

    // Calculate rating stats across approved reviews
    const allApproved = await db.productReview.findMany({
      where: { status: "APPROVED" },
      select: { rating: true },
    })

    const totalCount = allApproved.length
    const ratingCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    let ratingSum = 0

    allApproved.forEach((r) => {
      ratingSum += r.rating
      if (r.rating >= 1 && r.rating <= 5) {
        ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1
      }
    })

    const averageRating = totalCount > 0 ? Number((ratingSum / totalCount).toFixed(1)) : 5.0

    // Fetch products for selector dropdown
    const products = await db.product.findMany({
      where: { status: "AVAILABLE" },
      select: { id: true, name: true, slug: true, type: true },
      take: 30,
    })

    return NextResponse.json({
      success: true,
      data: reviews,
      products,
      stats: {
        totalCount,
        averageRating,
        ratingCounts,
      },
    })
  } catch (error) {
    console.error("GET /api/feedback error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch feedback" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const body = await req.json()

    const parsed = createFeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 422 })
    }

    const { rating, title, body: feedbackBody, productId, authorName } = parsed.data

    let targetProductId = productId

    if (!targetProductId || targetProductId === "GENERAL") {
      const firstProd = await db.product.findFirst({ select: { id: true } })
      if (!firstProd) {
        return NextResponse.json({ success: false, error: "No product found" }, { status: 400 })
      }
      targetProductId = firstProd.id
    }

    const userId = session?.user?.id
    const isAdmin = session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "SUB_ADMIN"

    let authorId = userId
    if (!authorId) {
      const guestUser = await db.user.upsert({
        where: { email: "guest-feedback@nexusai.app" },
        update: {
          name: authorName || "Verified User",
        },
        create: {
          email: "guest-feedback@nexusai.app",
          name: authorName || "Verified User",
          role: "USER",
        },
        select: { id: true },
      })
      authorId = guestUser.id
    }

    // Upsert or create review so user can post feedback
    const review = await db.productReview.create({
      data: {
        productId: targetProductId,
        userId: authorId,
        rating,
        title,
        body: feedbackBody,
        verifiedPurchase: true,
        status: "APPROVED", // Approved so it appears immediately on the feedback page
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, role: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    })

    // Update product rating summary
    const agg = await db.productReview.aggregate({
      where: { productId: targetProductId, status: "APPROVED" },
      _avg: { rating: true },
      _count: true,
    })

    await db.product.update({
      where: { id: targetProductId },
      data: {
        averageRating: agg._avg.rating ?? rating,
        reviewCount: agg._count,
      },
    })

    return NextResponse.json({ success: true, data: review }, { status: 201 })
  } catch (error) {
    console.error("POST /api/feedback error:", error)
    return NextResponse.json({ success: false, error: "Failed to submit feedback" }, { status: 500 })
  }
}
