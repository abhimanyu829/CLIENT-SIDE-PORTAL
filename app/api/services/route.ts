import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const services = await db.purchasedService.findMany({
      where: { userId: session.user.id, status: { not: "DELETED" } },
      include: {
        product: { select: { name: true, slug: true, thumbnailUrl: true, iconUrl: true } },
        orderItem: { select: { name: true } },
        deployment: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ success: true, data: services })
  } catch (err) {
    console.error("[services GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load services" }, { status: 500 })
  }
}
