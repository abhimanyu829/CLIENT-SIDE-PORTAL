import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { OrderStatus } from "@prisma/client"

/**
 * GET /api/campaigns/targeted
 *
 * Public endpoint — no admin auth needed.
 * Resolves which active ServiceDiscoveryCampaigns should be shown
 * to the current visitor based on:
 *   - page          (query param, e.g. ?page=/)
 *   - visitorType   (derived from session + purchase history)
 *
 * Returns an array of matching campaigns sorted by priority desc.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = searchParams.get("page") ?? "/"

    // Determine visitor context from session
    const session = await auth()
    const userId = session?.user?.id ?? null

    let hasPurchased = false
    let purchaseCount = 0
    let userRole = "GUEST"

    if (userId) {
      const [user, orderCount] = await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, createdAt: true },
        }),
        db.order.count({
          where: { userId, status: { in: [OrderStatus.PAID, OrderStatus.FULFILLED] } },
        }),
      ])
      hasPurchased = orderCount > 0
      purchaseCount = orderCount
      userRole = user?.role ?? "USER"
    }

    const visitorType = !userId ? "guest" : hasPurchased ? "paid_customer" : "logged_in"

    // Fetch all active service discovery campaigns
    const now = new Date()
    const allActive = await db.serviceDiscoveryCampaign.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    })

    // Filter by targeting rules stored in targetAudience JSON
    const matched = allActive.filter((campaign) => {
      const target = (campaign.targetAudience ?? {}) as Record<string, unknown>

      // ── Page targeting ──────────────────────────────────────────────
      const targetPages = Array.isArray(target.pages) ? (target.pages as string[]) : []
      if (targetPages.length > 0) {
        const pageMatches = targetPages.some((p) => {
          const normalized = p.startsWith("/") ? p : `/${p}`
          return page === normalized || page.startsWith(normalized + "/")
        })
        if (!pageMatches) return false
      }

      // ── Visitor type targeting ───────────────────────────────────────
      const tv = typeof target.visitorType === "string" ? target.visitorType : "all"
      if (tv !== "all") {
        if (tv === "guest" && visitorType !== "guest") return false
        if (tv === "logged_in" && visitorType === "guest") return false
        if (tv === "paid_customer" && !hasPurchased) return false
        if (tv === "free_user" && (visitorType === "guest" || hasPurchased)) return false
      }

      // ── Role targeting ────────────────────────────────────────────────
      const roles = Array.isArray(target.roles) ? (target.roles as string[]) : []
      if (roles.length > 0 && userId && !roles.includes(userRole)) return false

      // ── Min purchase count ─────────────────────────────────────────────
      const minPurchase =
        typeof target.minPurchaseCount === "number" ? target.minPurchaseCount : 0
      if (minPurchase > 0 && purchaseCount < minPurchase) return false

      // ── Has purchased boolean ──────────────────────────────────────────
      const hpTarget =
        typeof target.hasPurchased === "boolean" ? target.hasPurchased : null
      if (hpTarget === true && !hasPurchased) return false
      if (hpTarget === false && hasPurchased) return false

      return true
    })

    return NextResponse.json({
      success: true,
      data: matched.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        bannerUrl: c.bannerUrl,
        backgroundUrl: c.backgroundUrl,
        videoUrl: c.videoUrl,
        ctaLabel: c.ctaLabel,
        landingUrl: c.landingUrl,
        endsAt: c.endsAt?.toISOString() ?? null,
        targetAudience: c.targetAudience,
      })),
      visitorContext: { visitorType, hasPurchased, purchaseCount, page },
    })
  } catch (error) {
    console.error("[/api/campaigns/targeted]", error)
    return NextResponse.json({ success: false, data: [] }, { status: 500 })
  }
}
