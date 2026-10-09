import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  cancelRecurringSubscription,
  pauseRecurringSubscription,
  resumeRecurringSubscription,
} from "@/lib/services/razorpay-billing"

export const dynamic = "force-dynamic"

/**
 * Supported self-service subscription actions. Ownership is enforced inside
 * the Phase-4 operations (actorId = session user). Unknown actions and
 * unsupported states are rejected with the backend's typed error.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  let body: { subscriptionId?: unknown; action?: unknown; cancelAtCycleEnd?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
  const subscriptionId = typeof body?.subscriptionId === "string" ? body.subscriptionId.trim() : ""
  const action = body?.action
  if (!subscriptionId || typeof action !== "string") {
    return NextResponse.json({ success: false, error: "subscriptionId and action are required" }, { status: 400 })
  }

  try {
    switch (action) {
      case "cancel": {
        const cancelAtCycleEnd = body?.cancelAtCycleEnd === true
        const result = await cancelRecurringSubscription(subscriptionId, session.user.id, cancelAtCycleEnd)
        return NextResponse.json({ success: true, data: result })
      }
      case "pause": {
        const result = await pauseRecurringSubscription(subscriptionId, session.user.id)
        return NextResponse.json({ success: true, data: result })
      }
      case "resume": {
        const result = await resumeRecurringSubscription(subscriptionId, session.user.id)
        return NextResponse.json({ success: true, data: result })
      }
      default:
        return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed"
    console.error("[customer/subscriptions/action]", action, message)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}