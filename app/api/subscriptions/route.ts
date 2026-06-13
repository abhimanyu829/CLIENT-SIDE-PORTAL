import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/subscriptions — list subscriptions for authenticated user
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role
    const isAdmin = role === "SUPER_ADMIN" || role === "SUB_ADMIN"

    const where = isAdmin ? {} : { userId: session.user.id }

    const subscriptions = await db.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, slug: true, thumbnailUrl: true } },
        tier: { select: { name: true, price: true, currency: true, interval: true } },
      },
    })

    return NextResponse.json({ data: subscriptions })
  } catch (err) {
    console.error("[subscriptions] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
