import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getRazorpay } from "@/lib/razorpay"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

const schema = z.object({
  purchasedServiceId: z.string().min(1),
  addonId: z.string().min(1),
})

function toPaise(amount: unknown): number {
  const num = Math.round(Number(amount) * 100)
  if (isNaN(num) || num < 100) return 100
  return num
}

/// POST /api/payments/razorpay/addon-order
/// Creates a Razorpay order for a service add-on.
/// Price is ALWAYS read from the DB — never passed by the client.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, isVerified: true, isBanned: true },
    })
    if (!user?.isVerified || user.isBanned) {
      return NextResponse.json({ success: false, error: { code: "ACCOUNT_RESTRICTED", message: "Verify your account before purchase." } }, { status: 403 })
    }

    const client = getRazorpay()
    if (!client) {
      return NextResponse.json({ success: false, error: { code: "RAZORPAY_NOT_CONFIGURED", message: "Payment gateway not configured." } }, { status: 503 })
    }

    const body = schema.safeParse(await req.json())
    if (!body.success) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: body.error.issues[0]?.message } }, { status: 400 })
    }

    const { purchasedServiceId, addonId } = body.data

    // 1. Verify the purchased service belongs to this user
    const service = await db.purchasedService.findFirst({
      where: { id: purchasedServiceId, userId: session.user.id },
      select: { id: true, productId: true, orderItem: { select: { name: true } } },
    })
    if (!service) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service not found" } }, { status: 404 })
    }

    // 2. Fetch addon price from DB (never trust client)
    const addon = await db.addonCatalogItem.findFirst({
      where: {
        id: addonId,
        isActive: true,
        OR: [{ applicableProductIds: { isEmpty: true } }, { applicableProductIds: { has: service.productId } }],
      },
      select: { id: true, name: true, price: true, currency: true },
    })
    if (!addon) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Add-on not available for this service" } }, { status: 404 })
    }

    // 3. Check for duplicate in-progress upgrade
    const existing = await db.serviceUpgrade.findFirst({
      where: { purchasedServiceId: service.id, addonId, status: { in: ["PENDING", "PAID"] } },
    })
    if (existing) {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "This upgrade is already in progress" } }, { status: 409 })
    }

    // 4. Create internal order record for traceability
    const orderNumber = `ADDON-${Date.now()}-${addonId.slice(-6).toUpperCase()}`
    const internalOrder = await db.order.create({
      data: {
        userId: session.user.id,
        orderNumber,
        status: "PENDING",
        subtotal: addon.price,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: addon.price,
        currency: addon.currency,
        gateway: "RAZORPAY",
        metadata: {
          type: "ADDON_PURCHASE",
          addonId: addon.id,
          addonName: addon.name,
          purchasedServiceId: service.id,
        } as any,
      },
    })

    // 5. Create Razorpay order (amount in paise; price comes from DB)
    const paiseAmount = toPaise(addon.price)
    const razorpayOrder = await client.orders.create({
      amount: paiseAmount,
      currency: addon.currency || "INR",
      receipt: orderNumber,
      payment_capture: 1,
      notes: {
        orderId: internalOrder.id,
        orderNumber,
        userId: session.user.id,
        addonId: addon.id,
        addonName: addon.name,
        purchasedServiceId: service.id,
        type: "ADDON_PURCHASE",
      },
    } as any)

    // 6. Attach gateway order
    await db.payment.create({
      data: {
        orderId: internalOrder.id,
        userId: session.user.id,
        gateway: "RAZORPAY",
        status: "PENDING",
        amount: addon.price,
        currency: addon.currency,
        gatewayOrderId: razorpayOrder.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.RAZORPAY_KEY_ID,
        internalOrderId: internalOrder.id,
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
        },
        addon: {
          id: addon.id,
          name: addon.name,
          price: Number(addon.price),
          currency: addon.currency,
        },
      },
    }, { status: 201 })
  } catch (err) {
    logger.error({ err }, "API error POST /api/payments/razorpay/addon-order")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Unable to create addon payment order" } }, { status: 500 })
  }
}
