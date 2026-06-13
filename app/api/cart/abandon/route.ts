import { NextRequest, NextResponse } from "next/server"
import { requireApiAuth } from "@/lib/api-auth"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { notifQueue } from "@/lib/queue"

const abandonSchema = z.object({
  cartItems: z
    .array(
      z.object({
        tierId: z.string(),
        productId: z.string(),
        productName: z.string(),
        price: z.number(),
      })
    )
    .min(1),
})

/**
 * POST /api/cart/abandon
 * Called by the frontend when a user navigates away from checkout with items
 * still in their cart. Starts the BullMQ abandonment recovery sequence.
 *
 * The frontend should debounce this — only call after a confirmed inactivity
 * window (e.g. 10 minutes without completing checkout).
 */
export async function POST(req: NextRequest) {
  try {
    let userId: string
    try {
      userId = await requireApiAuth()
    } catch {
      // Unauthenticated users can't be recovered by email — no-op
      return NextResponse.json({ success: true, data: { queued: false, reason: "unauthenticated" } })
    }

    const body = await req.json()
    const parsed = abandonSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const { cartItems } = parsed.data

    // Queue the first step with a 30-minute delay
    await notifQueue.add(
      "abandon.start",
      { userId, cartItems, step: 0 },
      { delay: 30 * 60 * 1000 } // 30 minutes
    )

    logger.info({ userId, itemCount: cartItems.length }, "Cart abandonment sequence started")

    return NextResponse.json({ success: true, data: { queued: true } })
  } catch (error) {
    logger.error({ error }, "POST /api/cart/abandon")
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}
