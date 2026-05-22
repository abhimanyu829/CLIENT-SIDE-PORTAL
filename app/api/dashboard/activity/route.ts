import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    const [notifications, auditLogs] = await Promise.all([
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      db.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ])

    const typeIcon: Record<string, string> = {
      PAYMENT: "💳",
      TICKET: "🎫",
      SUBSCRIPTION: "⬡",
      PROJECT: "📋",
      CHAT: "✦",
      SYSTEM: "🔔",
    }

    const entityIcon: Record<string, string> = {
      Invoice: "💳",
      Ticket: "🎫",
      Subscription: "⬡",
      Project: "📋",
      User: "👤",
    }

    const notifItems = notifications.map((n) => ({
      id: n.id,
      icon: typeIcon[n.type] ?? "🔔",
      title: n.title,
      desc: n.body,
      time: n.createdAt,
      type: n.type,
      isRead: n.isRead,
      actionUrl: n.actionUrl,
    }))

    const auditItems = auditLogs.map((a) => ({
      id: a.id,
      icon: (a.entity && entityIcon[a.entity]) ?? "📝",
      title: a.action,
      desc: `${a.entity ?? ""} ${a.entityId?.slice(0, 8) ?? ""}`.trim(),
      time: a.createdAt,
      type: "AUDIT",
      isRead: true,
      actionUrl: null,
    }))

    const merged = [...notifItems, ...auditItems]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20)

    return NextResponse.json({ data: merged })
  } catch (err) {
    console.error("[dashboard/activity]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
