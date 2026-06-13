import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * POST /api/products/validate-purchase
 *
 * Pre-purchase validation endpoint. Checks:
 * - Authentication
 * - Email verification
 * - Product existence and status
 * - Ownership (already owned?)
 * - Inventory availability
 * - Pricing tier validity
 * - Subscription conflicts
 *
 * Returns { valid: true } or { valid: false, reasons: [...] }
 */
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({
      valid: false,
      reasons: ["AUTH_REQUIRED"],
      redirectUrl: `/login?callbackUrl=${encodeURIComponent("/marketplace")}`,
    }, { status: 401 })
  }

  const body = await req.json()
  const { productId, tierId } = body

  if (!productId) {
    return NextResponse.json({ valid: false, reasons: ["MISSING_PRODUCT_ID"] }, { status: 400 })
  }

  const reasons: string[] = []

  // Fetch user from DB to ensure we have the latest verification status
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isVerified: true },
  })

  // Check email verification (optional, if we require it for purchase)
  if (dbUser && !dbUser.isVerified) {
    reasons.push("EMAIL_NOT_VERIFIED")
  }

  // Check product existence and status
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { tiers: { where: { isActive: true } } },
  })

  if (!product) {
    return NextResponse.json({ valid: false, reasons: ["PRODUCT_NOT_FOUND"] }, { status: 404 })
  }

  if (product.status !== "AVAILABLE") {
    reasons.push("PRODUCT_NOT_AVAILABLE")
  }

  // Check ownership
  const entitlement = await db.customerEntitlement.findFirst({
    where: {
      userId: session.user.id,
      productId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true, accessType: true },
  })

  if (entitlement) {
    reasons.push("ALREADY_OWNED")
  }

  // Check inventory
  if (product.inventoryEnabled && (product.inventoryCount ?? 0) <= 0) {
    reasons.push("SOLD_OUT")
  }

  // Check tier validity
  if (tierId) {
    const tier = product.tiers.find(t => t.id === tierId)
    if (!tier) {
      reasons.push("INVALID_TIER")
    }
  } else if (product.tiers.length === 0) {
    reasons.push("NO_ACTIVE_TIERS")
  }

  // Check subscription conflicts
  if (entitlement && tierId) {
    const tier = product.tiers.find(t => t.id === tierId)
    if (tier?.interval === "MONTHLY" || tier?.interval === "YEARLY") {
      const existingSub = await db.subscription.findFirst({
        where: {
          userId: session.user.id,
          productId,
          status: { in: ["ACTIVE", "TRIALING"] },
        },
        select: { id: true },
      })
      if (existingSub) {
        reasons.push("ACTIVE_SUBSCRIPTION_EXISTS")
      }
    }
  }

  if (reasons.length > 0) {
    return NextResponse.json({
      valid: false,
      reasons,
      message: reasons.includes("ALREADY_OWNED") ? "You already own this product." : undefined,
    }, { status: 200 })
  }

  return NextResponse.json({
    valid: true,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      type: product.type,
      inventoryEnabled: product.inventoryEnabled,
      inventoryCount: product.inventoryCount,
    },
  })
}
