import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { addMarketplaceItemToCart } from "@/lib/services/enterprise-commerce-service"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cart = await db.cart.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { items: { include: { product: true, tier: true } } },
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({ data: cart })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  if (!body.productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 })
  }

  const cart = await addMarketplaceItemToCart({
    userId: session.user.id,
    productId: body.productId,
    tierId: body.tierId,
    quantity: body.quantity,
    region: body.region,
  })

  return NextResponse.json({ data: cart }, { status: 201 })
}
