import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  addMarketplaceItemToCart,
  applyCouponToActiveCart,
  clearActiveCart,
  getActiveCart,
  updateCartItemQuantity,
} from "@/lib/services/enterprise-commerce-service"

async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED")
  }
  return session.user.id
}

export async function GET() {
  try {
    const userId = await requireAuth()
    const cart = await getActiveCart({ userId })
    return NextResponse.json({ data: cart })
  } catch (error) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const body = await req.json()
    if (!body.productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 })
    }

    const cart = await addMarketplaceItemToCart({
      userId,
      productId: body.productId,
      tierId: body.tierId,
      quantity: body.quantity,
      region: body.region,
    })

    return NextResponse.json({ data: cart }, { status: 201 })
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    const msg = (error as Error).message
    if (msg === "ALREADY_OWNED") {
      return NextResponse.json({ error: "You already own this product", code: "ALREADY_OWNED" }, { status: 409 })
    }
    if (msg === "SOLD_OUT") {
      return NextResponse.json({ error: "This product is sold out", code: "SOLD_OUT" }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireAuth()
    const body = await req.json()

    if (body.action === "apply_coupon") {
      const cart = await applyCouponToActiveCart({ userId, couponCode: body.couponCode })
      return NextResponse.json({ data: cart })
    }

    if (body.action === "remove_coupon") {
      const cart = await applyCouponToActiveCart({ userId, couponCode: null })
      return NextResponse.json({ data: cart })
    }

    if (body.action === "update_quantity") {
      if (!body.itemId || typeof body.quantity !== "number") {
        return NextResponse.json({ error: "itemId and quantity are required" }, { status: 400 })
      }
      const cart = await updateCartItemQuantity({ userId, itemId: body.itemId, quantity: body.quantity })
      return NextResponse.json({ data: cart })
    }

    return NextResponse.json({ error: "Unsupported cart action" }, { status: 400 })
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE() {
  try {
    const userId = await requireAuth()
    await clearActiveCart({ userId })
    return NextResponse.json({ data: null })
  } catch (error) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
}
