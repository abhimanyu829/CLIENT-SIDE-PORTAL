import { NextRequest, NextResponse } from "next/server"
import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"
import { getAdminSubscriptionDetail } from "@/lib/services/admin-subscription-service"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> } | { params: { id: string } }) {
  const gate = await adminSubscriptionGate("VIEW")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  const { id } = await ctx.params
  try {
    const data = await getAdminSubscriptionDetail(id)
    if (!data) return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[admin governance subscription detail]", err)
    return NextResponse.json({ success: false, error: "Failed to load subscription" }, { status: 500 })
  }
}