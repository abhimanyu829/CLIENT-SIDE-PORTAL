import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * POST /api/preview/start
 *
 * Starts a preview session for a product.
 * Requires authentication. Enforces max preview count per user.
 * Returns a session token with expiry.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED", redirectUrl: `/login?callbackUrl=${encodeURIComponent("/marketplace")}` }, { status: 401 })
  }

  const { productId } = await req.json()
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 })
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      previewEnabled: true,
      previewConfig: true,
      status: true,
    },
  })

  if (!product || !product.previewEnabled) {
    return NextResponse.json({ error: "Preview not available for this product" }, { status: 404 })
  }

  if (product.status !== "AVAILABLE") {
    return NextResponse.json({ error: "Product is not available for preview" }, { status: 400 })
  }

  const config = (product.previewConfig as any) ?? {}
  const maxPreviews = config.maxPreviewsPerUser ?? 5
  const timeoutMinutes = config.sessionTimeoutMinutes ?? 6

  // Check if user already owns this product
  const entitlement = await db.customerEntitlement.findFirst({
    where: {
      userId: session.user.id,
      productId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  })

  if (entitlement) {
    return NextResponse.json({ error: "ALREADY_OWNED", message: "You already own this product" }, { status: 409 })
  }

  // Count user's preview sessions for this product
  const existingCount = await db.previewSession.count({
    where: {
      userId: session.user.id,
      productId,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
    },
  })

  if (existingCount >= maxPreviews) {
    return NextResponse.json({
      error: "PREVIEW_LIMIT_REACHED",
      message: `You've used all ${maxPreviews} preview sessions for this product this month.`,
      maxPreviews,
      used: existingCount,
    }, { status: 429 })
  }

  // Create preview session
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000)
  const previewSession = await db.previewSession.create({
    data: {
      userId: session.user.id,
      productId,
      status: "ACTIVE",
      expiresAt,
      config: {
        environmentType: config.environmentType ?? "container",
        sessionTimeoutMinutes: timeoutMinutes,
      },
    },
  })

  return NextResponse.json({
    sessionId: previewSession.id,
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    expiresAt: expiresAt.toISOString(),
    timeoutMinutes,
    remainingPreviews: maxPreviews - existingCount - 1,
  })
}