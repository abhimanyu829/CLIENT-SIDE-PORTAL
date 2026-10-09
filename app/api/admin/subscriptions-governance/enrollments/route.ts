import { NextRequest, NextResponse } from "next/server"
import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"
import { listEnrollments, listOperationalIssues, listAdminAudit } from "@/lib/services/admin-subscription-service"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const gate = await adminSubscriptionGate("VIEW")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  const type = req.nextUrl.searchParams.get("type") === "free" ? "free" : "trial"
  try {
    const data = await listEnrollments(type)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[admin governance enrollments]", err)
    return NextResponse.json({ success: false, error: "Failed to list enrollments" }, { status: 500 })
  }
}
