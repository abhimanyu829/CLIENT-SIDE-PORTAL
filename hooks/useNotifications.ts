"use client"
import { useEffect, useRef } from "react"
import { useDashboardStore } from "./useDashboardStore"

export function useNotifications(userId?: string) {
  const { setNotifications, addNotification, markRead, markAllRead, unreadCount, notifications } =
    useDashboardStore()
  const isFetching = useRef(false)

  const fetchNotifications = async () => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      const res = await fetch("/api/notifications", { credentials: "include" })
      if (!res.ok) return
      const { data } = await res.json()
      setNotifications(
        (data ?? []).map((n: any) => ({
          id: n.id,
          icon:
            n.type === "PAYMENT"
              ? "💳"
              : n.type === "TICKET"
              ? "🎫"
              : n.type === "SUBSCRIPTION"
              ? "⬡"
              : n.type === "PROJECT"
              ? "📋"
              : n.type === "CHAT"
              ? "✦"
              : "🔔",
          title: n.title,
          body: n.body,
          isRead: n.isRead,
          type: n.type,
          actionUrl: n.actionUrl,
          createdAt: n.createdAt,
        }))
      )
    } catch {
      // silently fail
    } finally {
      isFetching.current = false
    }
  }

  const handleMarkRead = async (id: string) => {
    markRead(id)
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  const handleMarkAllRead = async () => {
    markAllRead()
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllAsRead: true }),
    }).catch(() => {})
  }

  useEffect(() => {
    fetchNotifications()
    // Poll every 30 seconds as fallback
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [userId]) // eslint-disable-line

  return { notifications, unreadCount, markRead: handleMarkRead, markAllRead: handleMarkAllRead, refetch: fetchNotifications }
}
