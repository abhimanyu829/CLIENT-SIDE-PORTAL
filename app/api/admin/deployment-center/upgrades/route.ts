import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const status = req.nextUrl.searchParams.get("status")

    const upgrades = await db.serviceUpgrade.findMany({
      where: status ? { status: status as any } : {},
      include: {
        user: { select: { id: true, name: true, email: true } },
        purchasedService: {
          select: { id: true, status: true, orderItem: { select: { name: true } }, product: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return NextResponse.json({ success: true, data: upgrades })
  } catch (err) {
    console.error("[admin/deployment-center/upgrades GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load upgrades" }, { status: 500 })
  }
}
