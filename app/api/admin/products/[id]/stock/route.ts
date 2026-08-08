/**
 * GET  /api/admin/products/[id]/stock  — fetch stock record + last 50 history entries
 * PATCH /api/admin/products/[id]/stock  — mutate stock (increase / decrease / reset / restock / etc.)
 *
 * All mutations write a StockHistory entry and call revalidateProductCaches.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/admin-audit"
import { revalidateTag, revalidatePath } from "next/cache"

const REVALIDATE_PROFILE = "max" as any

async function revalidateStockCaches(slug?: string | null) {
  revalidateTag("products", REVALIDATE_PROFILE)
  revalidateTag("featured-products", REVALIDATE_PROFILE)
  revalidateTag("home-products", REVALIDATE_PROFILE)
  revalidatePath("/admin/products")
  revalidatePath("/marketplace")
  revalidatePath("/")
  if (slug) revalidatePath(`/marketplace/${slug}`)
}

type StockAction =
  | "INCREASE"
  | "DECREASE"
  | "RESET"
  | "RESTOCK"
  | "MARK_OUT"
  | "MARK_IN"
  | "EDIT"
  | "TOGGLE_VISIBILITY"
  | "TOGGLE_BACKORDERS"
  | "SET_THRESHOLD"
  | "SET_WARNING"
  | "SET_RESTOCK_QTY"
  | "SET_TOTAL"

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await requireAdmin()

    const stock = await db.productStock.findUnique({
      where: { productId: id },
      include: {
        history: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    })

    const product = await db.product.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, status: true, inventoryEnabled: true },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    return NextResponse.json({ data: { stock, product } })
  } catch (err) {
    console.error("[stock] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const admin = await requireAdmin()
    const body = await req.json() as {
      action: StockAction
      qty?: number
      reason?: string
      value?: number | boolean | string
    }

    const { action, reason } = body
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    // Fetch product + existing stock
    const product = await db.product.findUnique({
      where: { id },
      select: { id: true, slug: true, status: true, name: true },
    })
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Upsert stock record if not exists
    let stock = await db.productStock.upsert({
      where: { productId: id },
      create: { productId: id },
      update: {},
    })

    const before = { ...stock }
    let patch: Partial<typeof stock> = {}
    let historyField = "availableStock"
    let prevVal = stock.availableStock
    let nextVal = stock.availableStock

    const qty = typeof body.qty === "number" ? Math.max(0, Math.floor(body.qty)) : 0

    switch (action) {
      case "INCREASE":
        nextVal = stock.availableStock + qty
        patch = {
          availableStock: nextVal,
          totalStock: stock.totalStock + qty,
          isOutOfStock: nextVal <= 0,
        }
        break

      case "DECREASE":
        nextVal = Math.max(0, stock.availableStock - qty)
        patch = {
          availableStock: nextVal,
          isOutOfStock: nextVal <= 0,
        }
        break

      case "RESET":
        prevVal = stock.availableStock
        nextVal = 0
        patch = {
          availableStock: 0,
          reservedStock: 0,
          isOutOfStock: true,
        }
        break

      case "RESTOCK": {
        const restockQty = qty || stock.restockQty
        nextVal = stock.availableStock + restockQty
        patch = {
          availableStock: nextVal,
          totalStock: stock.totalStock + restockQty,
          isOutOfStock: false,
        }
        break
      }

      case "MARK_OUT":
        prevVal = stock.isOutOfStock ? 1 : 0
        nextVal = 1
        patch = { isOutOfStock: true, availableStock: 0 }
        historyField = "isOutOfStock"
        break

      case "MARK_IN":
        prevVal = stock.isOutOfStock ? 1 : 0
        nextVal = 0
        patch = { isOutOfStock: false }
        historyField = "isOutOfStock"
        break

      case "EDIT":
        nextVal = typeof body.value === "number" ? Math.max(0, body.value) : stock.availableStock
        patch = {
          availableStock: nextVal,
          isOutOfStock: nextVal <= 0,
        }
        break

      case "SET_TOTAL":
        historyField = "totalStock"
        prevVal = stock.totalStock
        nextVal = typeof body.value === "number" ? Math.max(0, body.value) : stock.totalStock
        patch = { totalStock: nextVal }
        break

      case "TOGGLE_VISIBILITY":
        historyField = "stockVisible"
        prevVal = stock.stockVisible ? 1 : 0
        nextVal = stock.stockVisible ? 0 : 1
        patch = { stockVisible: !stock.stockVisible }
        break

      case "TOGGLE_BACKORDERS":
        historyField = "backOrdersEnabled"
        prevVal = stock.backOrdersEnabled ? 1 : 0
        nextVal = stock.backOrdersEnabled ? 0 : 1
        patch = { backOrdersEnabled: !stock.backOrdersEnabled }
        break

      case "SET_THRESHOLD":
        historyField = "lowStockThreshold"
        prevVal = stock.lowStockThreshold
        nextVal = typeof body.value === "number" ? Math.max(0, body.value) : stock.lowStockThreshold
        patch = { lowStockThreshold: nextVal }
        break

      case "SET_WARNING":
        historyField = "warningMessage"
        prevVal = 0
        nextVal = 0
        patch = { warningMessage: typeof body.value === "string" ? body.value : null }
        break

      case "SET_RESTOCK_QTY":
        historyField = "restockQty"
        prevVal = stock.restockQty
        nextVal = typeof body.value === "number" ? Math.max(0, body.value) : stock.restockQty
        patch = { restockQty: nextVal }
        break

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    // Auto-disable / enable product based on stock
    const productPatch: Record<string, any> = {}
    if (
      stock.autoDisableOnZero &&
      "availableStock" in patch &&
      (patch.availableStock ?? nextVal) <= 0
    ) {
      productPatch.inventoryEnabled = true
      productPatch.inventoryCount = 0
    }
    if (
      stock.autoEnableOnRestock &&
      action === "RESTOCK" &&
      (patch.availableStock ?? nextVal) > 0
    ) {
      productPatch.inventoryCount = patch.availableStock ?? nextVal
      if (product.status === "HIDDEN") productPatch.status = "AVAILABLE"
    }

    // Apply updates in transaction
    const [updatedStock] = await db.$transaction([
      db.productStock.update({ where: { productId: id }, data: patch }),
      db.stockHistory.create({
        data: {
          productStockId: stock.id,
          productId: id,
          adminId: admin.userId,
          adminEmail: admin.email,
          action,
          field: historyField,
          previousValue: prevVal,
          updatedValue: nextVal,
          reason: reason ?? null,
        },
      }),
      ...(Object.keys(productPatch).length > 0
        ? [db.product.update({ where: { id }, data: productPatch })]
        : []),
    ])

    await auditLog({
      userId: admin.userId,
      action: `STOCK_${action}`,
      entity: "ProductStock",
      entityId: stock.id,
      before,
      after: updatedStock,
    })

    await revalidateStockCaches(product.slug)

    return NextResponse.json({ data: updatedStock })
  } catch (err) {
    console.error("[stock] PATCH:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
