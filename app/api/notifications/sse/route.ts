import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/notifications/sse — Server-Sent Events stream for real-time notifications
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send unread count on connect
      const unread = await db.notification.count({
        where: { userId, isRead: false },
      })
      send({ type: "connected", unread })

      // Poll for new notifications every 15 seconds
      const interval = setInterval(async () => {
        try {
          const notifications = await db.notification.findMany({
            where: { userId, isRead: false },
            orderBy: { createdAt: "desc" },
            take: 10,
          })
          send({ type: "notifications", data: notifications })
        } catch {
          // Connection closed by client
          clearInterval(interval)
        }
      }, 15000)

      // Clean up on disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
