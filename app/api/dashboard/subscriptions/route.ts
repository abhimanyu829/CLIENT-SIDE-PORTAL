import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const [subscriptions, activePlans] = await Promise.all([
      // User's own subscription history
      db.userSubscription.findMany({
        where: { userId },
        include: {
          plan: {
            include: {
              benefits: { orderBy: { sortOrder: "asc" } },
            },
          },
          addons: {
            where: { isActive: true },
            include: {
              addonService: {
                select: { id: true, name: true, unitPrice: true, currency: true, billingCycle: true },
              },
            },
          },
          invoices: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Available plans to show for upgrade/switch
      db.subscriptionPlan.findMany({
        where: { isActive: true },
        include: {
          benefits: { orderBy: { sortOrder: "asc" } },
        },
        orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        subscriptions,
        availablePlans: activePlans,
      },
    })
  } catch (err) {
    console.error("[dashboard/subscriptions GET]", err)
    return NextResponse.json({ success: false, error: "Failed to fetch subscriptions" }, { status: 500 })
  }
}
