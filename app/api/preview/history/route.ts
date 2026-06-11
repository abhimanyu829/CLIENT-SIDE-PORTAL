import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/preview/history?productId=xxx
 *
 * Returns the current user's preview session history for a product.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const productId = searchParams.get("productId")

  const where: any = { userId: session.user.id }
  if (productId) where.productId = productId

  const sessions = await db.previewSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      productId: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      product: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
    },
  })

  return NextResponse.json({ data: sessions })
}