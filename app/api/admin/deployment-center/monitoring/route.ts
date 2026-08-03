import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

/// Business monitoring (NOT server monitoring): purchases, deployments,
/// renewals, upgrades, requests, expiries.
export async function GET(_req: NextRequest) {
  try {
    await requireAdmin()

    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 86400000)
    const in30Days = new Date(now.getTime() + 30 * 86400000)

    const [
      totalServices,
      byStatus,
      pendingDeployments,
      completedDeployments,
      failedDeployments,
      expiredServices,
      upcomingRenewals7d,
      upcomingRenewals30d,
      pendingUpgrades,
      paidUpgrades,
      openRequests,
      recentTimeline,
    ] = await Promise.all([
      db.purchasedService.count({ where: { status: { not: "DELETED" } } }),
      db.purchasedService.groupBy({ by: ["status"], _count: { _all: true } }),
      db.serviceDeployment.count({ where: { status: { notIn: ["COMPLETED", "FAILED"] } } }),
      db.serviceDeployment.count({ where: { status: "COMPLETED" } }),
      db.serviceDeployment.count({ where: { status: "FAILED" } }),
      db.purchasedService.count({ where: { status: "EXPIRED" } }),
      db.purchasedService.count({ where: { status: "ACTIVE", expiryDate: { gt: now, lte: in7Days } } }),
      db.purchasedService.count({ where: { status: "ACTIVE", expiryDate: { gt: now, lte: in30Days } } }),
      db.serviceUpgrade.count({ where: { status: "PENDING" } }),
      db.serviceUpgrade.count({ where: { status: "PAID" } }),
      db.serviceRequest.count({ where: { purchasedServiceId: { not: null }, status: "OPEN" } }),
      db.serviceTimelineEvent.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        totalServices,
        byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
        deployments: { pending: pendingDeployments, completed: completedDeployments, failed: failedDeployments },
        expiredServices,
        upcomingRenewals: { next7Days: upcomingRenewals7d, next30Days: upcomingRenewals30d },
        upgrades: { pending: pendingUpgrades, awaitingApplication: paidUpgrades },
        openRequests,
        recentTimeline,
      },
    })
  } catch (err) {
    console.error("[admin/deployment-center/monitoring GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load monitoring" }, { status: 500 })
  }
}
