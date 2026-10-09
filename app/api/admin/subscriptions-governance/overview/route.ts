import { NextRequest, NextResponse } from "next/server"
import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"
import { getGovernanceMetrics } from "@/lib/services/admin-subscription-service"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const gate = await adminSubscriptionGate("VIEW")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  try {
    const data = await getGovernanceMetrics()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[admin governance overview]", err)
    return NextResponse.json({ success: false, error: "Failed to load governance metrics" }, { status: 500 })
  }
}