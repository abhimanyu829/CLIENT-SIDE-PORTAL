import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/entitlements/check?productId=xxx
 *
 * Checks if the authenticated user owns (has an active entitlement for) a product.
 * Returns ownership status, entitlement details, and access type.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { owned: false, error: "UNAUTHORIZED" },
      { status: 401 },
    )
  }

  const { searchParams } = req.nextUrl
  const productId = searchParams.get("productId")
  if (!productId) {
    return NextResponse.json(
      { owned: false, error: "productId is required" },
      { status: 400 },
    )
  }

  const entitlement = await db.customerEntitlement.findFirst({
    where: {
      userId: session.user.id,
      productId,
      status: "ACTIVE",
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: {
      id: true,
      accessType: true,
      expiresAt: true,
      orderId: true,
      subscriptionId: true,
    },
  })

  return NextResponse.json({
    owned: !!entitlement,
    entitlementId: entitlement?.id ?? null,
    accessType: entitlement?.accessType ?? null,
    expiresAt: entitlement?.expiresAt?.toISOString() ?? null,
  })
}