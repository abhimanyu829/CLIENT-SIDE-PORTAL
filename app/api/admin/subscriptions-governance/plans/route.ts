import { NextRequest, NextResponse } from "next/server"
import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"
import { listPlans, createPlan } from "@/lib/services/plan-catalog-service"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const gate = await adminSubscriptionGate("VIEW")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  try {
    const data = await listPlans()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[admin governance plans]", err)
    return NextResponse.json({ success: false, error: "Failed to list plans" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await adminSubscriptionGate("CREATE")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
  try {
    const data = await createPlan(body, gate.userId)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Plan creation failed"
    console.error("[admin governance plan create]", message)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}