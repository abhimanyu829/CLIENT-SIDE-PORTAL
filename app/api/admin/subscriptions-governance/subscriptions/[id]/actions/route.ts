import { NextRequest, NextResponse } from "next/server"
import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"
import {
  cancelRecurringSubscription,
  pauseRecurringSubscription,
  resumeRecurringSubscription,
} from "@/lib/services/razorpay-billing"

export const dynamic = "force-dynamic"

/**
 * Admin lifecycle actions (SUPER_ADMIN, or SUB_ADMIN with
 * SubscriptionGovernance:APPROVE). Runs through the Phase-4 provider ops with
 * the admin as the audited actor; ownership check is bypassed via byAdmin
 * (the RBAC gate above is the authorization boundary).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> } | { params: { id: string } }) {
  const gate = await adminSubscriptionGate("APPROVE")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  const { id } = await ctx.params
  let body: { action?: unknown; cancelAtCycleEnd?: unknown; reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
  const action = body?.action
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "admin action"
  if (typeof action !== "string") {
    return NextResponse.json({ success: false, error: "action is required" }, { status: 400 })
  }

  try {
    switch (action) {
      case "cancel": {
        const cancelAtCycleEnd = body?.cancelAtCycleEnd === true
        const result = await cancelRecurringSubscription(id, gate.userId, cancelAtCycleEnd, { byAdmin: true })
        return NextResponse.json({ success: true, data: { ...result, reason } })
      }
      case "pause": {
        const result = await pauseRecurringSubscription(id, gate.userId, { byAdmin: true })
        return NextResponse.json({ success: true, data: { ...result, reason } })
      }
      case "resume": {
        const result = await resumeRecurringSubscription(id, gate.userId, { byAdmin: true })
        return NextResponse.json({ success: true, data: { ...result, reason } })
      }
      default:
        return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed"
    console.error("[admin governance action]", action, message)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}