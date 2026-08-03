import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const timeline = await db.serviceTimelineEvent.findMany({
      where: { purchasedServiceId: id },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
    return NextResponse.json({ success: true, data: timeline })
  } catch (err) {
    console.error("[admin/deployment-center/[id]/timeline GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load timeline" }, { status: 500 })
  }
}
