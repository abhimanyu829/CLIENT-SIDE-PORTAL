import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { verifySubscriptionSignature } from "@/lib/services/razorpay-billing"

export const dynamic = "force-dynamic"

/**
 * Verifies the subscription-specific checkout signature (Phase-4 contract).
 * A verified callback NEVER activates billing — the webhook is the
 * authoritative lifecycle source. The UI shows an honest pending state.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  let body: { internalSubscriptionId?: unknown; razorpaySubscriptionId?: unknown; razorpayPaymentId?: unknown; razorpaySignature?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
  const internalSubscriptionId = typeof body?.internalSubscriptionId === "string" ? body.internalSubscriptionId : ""
  const razorpaySubscriptionId = typeof body?.razorpaySubscriptionId === "string" ? body.razorpaySubscriptionId : ""
  const razorpayPaymentId = typeof body?.razorpayPaymentId === "string" ? body.razorpayPaymentId : ""
  const signature = typeof body?.razorpaySignature === "string" ? body.razorpaySignature : ""
  if (!internalSubscriptionId || !razorpaySubscriptionId || !razorpayPaymentId || !signature) {
    return NextResponse.json({ success: false, error: "Missing checkout verification fields" }, { status: 400 })
  }

  // Ownership: the subscription must belong to the session user.
  const owned = await db.userSubscription.findFirst({
    where: { id: internalSubscriptionId, userId: session.user.id },
    select: { id: true, status: true },
  })
  if (!owned) {
    return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
  }

  const verified = verifySubscriptionSignature(razorpaySubscriptionId, razorpayPaymentId, signature)
  if (!verified) {
    return NextResponse.json({ success: false, error: "Invalid checkout signature" }, { status: 400 })
  }

  await db.userSubscription.update({
    where: { id: internalSubscriptionId },
    data: { metadata: { ...(((await db.userSubscription.findUnique({ where: { id: internalSubscriptionId }, select: { metadata: true } }))?.metadata ?? {}) as object), checkoutVerifiedAt: new Date().toISOString(), razorpayPaymentId } as never },
  }).catch(() => undefined)

  return NextResponse.json({
    success: true,
    data: {
      verified: true,
      status: owned.status,
      activation: "PENDING_VERIFICATION" as const,
      message: "Payment captured. Activation is confirmed by the payment webhook; current state may be pending.",
    },
  })
}