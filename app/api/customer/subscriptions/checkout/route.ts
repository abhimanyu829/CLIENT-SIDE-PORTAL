import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { env } from "@/lib/env"
import { createRecurringSubscription } from "@/lib/services/razorpay-billing"

export const dynamic = "force-dynamic"

/**
 * Initiates a recurring subscription through the Phase-4 service.
 * Returns ONLY the safe checkout contract: public key id, internal + provider
 * subscription ids and server-verified plan pricing for display. Never returns
 * secrets. Billing becomes active only via verified webhooks.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  let body: { planVersionId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
  const planVersionId = typeof body?.planVersionId === "string" ? body.planVersionId.trim() : ""
  if (!planVersionId) {
    return NextResponse.json({ success: false, error: "planVersionId is required" }, { status: 400 })
  }
  try {
    const created = await createRecurringSubscription({ planVersionId }, session.user.id)
    return NextResponse.json({
      success: true,
      data: {
        keyId: env.RAZORPAY_KEY_ID ?? "",
        internalSubscriptionId: created.internalSubscriptionId,
        razorpaySubscriptionId: created.razorpaySubscriptionId,
        planVersionId: created.planVersionId,
        environment: created.environment,
        existing: created.existing,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not initiate subscription"
    console.error("[customer/subscriptions/checkout]", message)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}