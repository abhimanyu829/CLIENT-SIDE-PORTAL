import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { applyUpgrade } from "@/lib/services/service-lifecycle-service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ upgradeId: string }> }) {
  try {
    const admin = await requireAdmin()
    const { upgradeId } = await params
    await applyUpgrade(upgradeId, admin.userId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to apply upgrade"
    console.error("[admin/deployment-center/upgrades/[upgradeId]/apply POST]", err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
