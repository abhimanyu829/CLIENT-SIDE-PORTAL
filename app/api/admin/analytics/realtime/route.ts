import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

// Server-Sent Events (SSE) endpoint for live admin dashboard stats
// The admin panel polls this or maintains a persistent connection
export async function GET(req: NextRequest) {
  await requireAdmin()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      const sendStats = async () => {
        try {
          const now = new Date()
          const todayStart = new Date(now)
          todayStart.setHours(0, 0, 0, 0)
          const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

          const [
            activeSubsCount,
            todayRevenue,
            todayNewUsers,
            pendingPayments,
            failedWebhooks,
            bannedUsers,
          ] = await Promise.all([
            db.subscription.count({ where: { status: "ACTIVE" } }),
            db.payment.aggregate({
              where: { status: "SUCCESS", paidAt: { gte: todayStart } },
              _sum: { amount: true },
            }),
            db.user.count({ where: { createdAt: { gte: todayStart } } }),
            db.payment.count({ where: { status: "PENDING" } }),
            db.webhookEvent.count({ where: { status: "FAILED" } }),
            db.user.count({ where: { isBanned: true } }),
          ])

          send({
            type: "STATS_UPDATE",
            timestamp: new Date().toISOString(),
            stats: {
              activeSubscriptions: activeSubsCount,
              todayRevenue: Number(todayRevenue._sum.amount ?? 0),
              todayNewUsers,
              pendingPayments,
              failedWebhooks,
              bannedUsers,
            },
          })
        } catch (err) {
          send({ type: "ERROR", message: "Failed to fetch stats" })
        }
      }

      // Send initial stats immediately
      await sendStats()

      // Refresh every 30 seconds
      const interval = setInterval(sendStats, 30_000)

      // Cleanup on client disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
