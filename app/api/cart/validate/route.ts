import { NextRequest, NextResponse } from "next/server"
import { requireApiAuth, UnauthorizedError } from "@/lib/api-auth"
import { db } from "@/lib/db"

/**
 * POST /api/cart/validate
 *
 * Validates all items in the user's active cart.
 * Checks: product existence, published status, ownership, inventory, tier validity.
 * Returns { valid: true } or { valid: false, issues: [...] }
 */
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await requireApiAuth()
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const cart = await db.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              type: true,
              inventoryEnabled: true,
              inventoryCount: true,
              previewEnabled: true,
            },
          },
          tier: {
            select: {
              id: true,
              name: true,
              isActive: true,
              price: true,
            },
          },
        },
      },
    },
  })

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ valid: true, issues: [] })
  }

  const issues: Array<{ itemId: string; productId: string; productName: string; issue: string }> = []

  for (const item of cart.items) {
    // Product existence
    if (!item.product) {
      issues.push({ itemId: item.id, productId: item.productId, productName: "Unknown", issue: "PRODUCT_REMOVED" })
      continue
    }

    // Product status
    if (item.product.status !== "AVAILABLE") {
      issues.push({ itemId: item.id, productId: item.productId, productName: item.product.name, issue: "PRODUCT_UNAVAILABLE" })
    }

    // Ownership check
    const entitlement = await db.customerEntitlement.findFirst({
      where: {
        userId: userId,
        productId: item.productId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    })
    if (entitlement) {
      issues.push({ itemId: item.id, productId: item.productId, productName: item.product.name, issue: "ALREADY_OWNED" })
    }

    // Inventory check
    if (item.product.inventoryEnabled && (item.product.inventoryCount ?? 0) <= 0) {
      issues.push({ itemId: item.id, productId: item.productId, productName: item.product.name, issue: "SOLD_OUT" })
    }

    // Tier validity
    if (item.tierId && !item.tier?.isActive) {
      issues.push({ itemId: item.id, productId: item.productId, productName: item.product.name, issue: "TIER_UNAVAILABLE" })
    }
  }

  return NextResponse.json({
    valid: issues.length === 0,
    issues,
    cartId: cart.id,
    itemCount: cart.items.length,
  })
}