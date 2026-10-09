import { NextRequest, NextResponse } from "next/server"
import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"
import { listAdminSubscriptions } from "@/lib/services/admin-subscription-service"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const gate = await adminSubscriptionGate("VIEW")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  const sp = req.nextUrl.searchParams
  const status = sp.get("status")?.trim() || undefined
  const planType = sp.get("planType")?.trim() || undefined
  const search = sp.get("search")?.trim() || undefined
  const sortFieldRaw = sp.get("sort")
  const sortField = sortFieldRaw === "currentPeriodEnd" || sortFieldRaw === "status" ? sortFieldRaw : "createdAt"
  const sortDir = sp.get("dir") === "asc" ? "asc" : "desc"
  const page = Number(sp.get("page") ?? "1") || 1
  const pageSize = Number(sp.get("pageSize") ?? "20") || 20

  try {
    const data = await listAdminSubscriptions({ page, pageSize, status, planType, search, sortField, sortDir })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[admin governance subscriptions]", err)
    return NextResponse.json({ success: false, error: "Failed to list subscriptions" }, { status: 500 })
  }
}
