import { db } from "@/lib/db"
import { NotifType, Prisma } from "@prisma/client"

// Map our local type to Prisma's NotifType enum
// Schema values: PAYMENT | TICKET | SUBSCRIPTION | PROJECT | SYSTEM | CHAT
export type NotificationType = "PAYMENT" | "ORDER" | "TICKET" | "SUBSCRIPTION" | "PROJECT" | "SYSTEM" | "CHAT" | "AI_USAGE" | "COMMERCE" | "VENDOR"

export interface CreateNotificationParams {
  userId: string
  title: string
  body: string
  type: NotificationType
  actionUrl?: string
  metadata?: Record<string, unknown>
}

export async function createNotification(params: CreateNotificationParams) {
  const { userId, title, body, type, actionUrl, metadata } = params

  try {
    const notification = await db.notification.create({
      data: {
        userId,
        title,
        body,
        type: type as NotifType,
        actionUrl,
        metadata: metadata as Prisma.InputJsonValue | undefined,
        isRead: false,
      },
    })

    // Try Pusher if available (optional — won't crash if not configured)
    try {
      const { pusherServer } = await import("./pusher")
      await pusherServer.trigger(`private-user-${userId}`, "new-notification", notification)
    } catch {
      // Pusher not configured — skip realtime push
    }

    return notification
  } catch (error) {
    console.error("[Notifications] Error creating notification:", error)
    throw error
  }
}
