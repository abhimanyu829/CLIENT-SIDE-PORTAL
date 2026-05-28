import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminPreviewsClient from "./AdminPreviewsClient"

export const metadata = { title: "Preview Sessions — Admin" }

export default async function AdminPreviewsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role)) {
    redirect("/unauthorized")
  }

  const now = new Date()

  const [activeSessions, recentSessions, abuseAlerts] = await Promise.all([
    db.demoSession.findMany({
      where: { isExpired: false, isRevoked: false, expiresAt: { gt: now } },
      include: {
        product: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    db.demoSession.findMany({
      orderBy: { startedAt: "desc" },
      take: 100,
      include: {
        product: { select: { id: true, name: true, slug: true } },
      },
    }),
    db.demoSession.findMany({
      where: { abuseFlag: true },
      include: {
        product: { select: { name: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ])

  // Aggregate analytics per product
  const productStats = await db.demoSession.groupBy({
    by: ["productId"],
    _count: { id: true },
    _sum: { convertedToOrder: true },
  }).catch(() => [])

  const serialized = {
    activeSessions: activeSessions.map((s) => ({
      ...s,
      expiresAt: s.expiresAt.toISOString(),
      startedAt: s.startedAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() ?? null,
      lastActivityAt: s.lastActivityAt?.toISOString() ?? null,
      convertedAt: s.convertedAt?.toISOString() ?? null,
    })),
    recentSessions: recentSessions.map((s) => ({
      ...s,
      expiresAt: s.expiresAt.toISOString(),
      startedAt: s.startedAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() ?? null,
      lastActivityAt: s.lastActivityAt?.toISOString() ?? null,
      convertedAt: s.convertedAt?.toISOString() ?? null,
    })),
    abuseAlerts: abuseAlerts.map((s) => ({
      ...s,
      expiresAt: s.expiresAt.toISOString(),
      startedAt: s.startedAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() ?? null,
      lastActivityAt: s.lastActivityAt?.toISOString() ?? null,
      convertedAt: s.convertedAt?.toISOString() ?? null,
    })),
    productStats,
  }

  return <AdminPreviewsClient data={serialized} />
}
