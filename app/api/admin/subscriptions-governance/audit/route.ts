import { NextRequest, NextResponse } from "next/server"
import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"
import { listAdminAudit } from "@/lib/services/admin-subscription-service"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const gate = await adminSubscriptionGate("VIEW")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1") || 1
  const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? "50") || 50
  try {
    const data = await listAdminAudit(page, pageSize)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[admin governance audit]", err)
    return NextResponse.json({ success: false, error: "Failed to load audit history" }, { status: 500 })
  }
}