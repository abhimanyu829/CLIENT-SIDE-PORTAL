/**
 * POST /api/admin/products/[id]/stock/decrement
 *
 * Internal-only route: called after VERIFIED purchase to decrement
 * availableStock and increment soldStock atomically.
 *
 * Callers: Razorpay verify handler, manual payment verify handler.
 * NOT exposed to frontend users.
 *
 * Body: { orderId: string, qty?: number }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { revalidateTag, revalidatePath } from "next/cache"

const REVALIDATE_PROFILE = "max" as any

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params
  try {
    await requireAdmin()

    const body = await req.json() as { orderId?: string; qty?: number }
    const qty = typeof body.qty === "number" && body.qty > 0 ? body.qty : 1

    const stock = await db.productStock.findUnique({ where: { productId } })
    if (!stock) {
      // No stock record — no-op, purchase still proceeds
      return NextResponse.json({ data: null, message: "No stock record" })
    }

    const newAvailable = stock.availableStock - qty
    const newSold = stock.soldStock + qty
    const isNowOutOfStock = !stock.backOrdersEnabled && newAvailable <= 0

    const [updatedStock] = await db.$transaction([
      db.productStock.update({
        where: { productId },
        data: {
          availableStock: Math.max(newAvailable, 0),
          soldStock: newSold,
          isOutOfStock: isNowOutOfStock,
        },
      }),
      db.stockHistory.create({
        data: {
          productStockId: stock.id,
          productId,
          adminId: "SYSTEM",
          adminEmail: "system@nexusai",
          action: "PURCHASE_DEDUCT",
          field: "availableStock",
          previousValue: stock.availableStock,
          updatedValue: Math.max(newAvailable, 0),
          reason: `Verified purchase`,
          orderId: body.orderId ?? null,
        },
      }),
    ])

    // Auto-disable product if stock hits 0 and autoDisableOnZero
    if (isNowOutOfStock && stock.autoDisableOnZero) {
      await db.product.update({
        where: { id: productId },
        data: { inventoryEnabled: true, inventoryCount: 0 },
      })
    }

    // Revalidate marketplace
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    })
    revalidateTag("products", REVALIDATE_PROFILE)
    revalidatePath("/marketplace")
    if (product?.slug) revalidatePath(`/marketplace/${product.slug}`)

    return NextResponse.json({ data: updatedStock })
  } catch (err) {
    console.error("[stock/decrement] POST:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
