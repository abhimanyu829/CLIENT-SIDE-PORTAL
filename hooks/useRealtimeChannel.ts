"use client"
import { useEffect, useRef } from "react"
import { useDashboardStore } from "./useDashboardStore"

interface PusherLike {
  subscribe: (channel: string) => {
    bind: (event: string, cb: (data: any) => void) => void
    unbind_all: () => void
  }
  unsubscribe: (channel: string) => void
}

let pusherInstance: PusherLike | null = null

async function getPusher(userId: string): Promise<PusherLike | null> {
  if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return null
  if (pusherInstance) return pusherInstance
  try {
    const PusherClient = (await import("pusher-js")).default
    const p = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap2",
      authEndpoint: "/api/pusher/auth",
      auth: { headers: {} },
    }) as any
    pusherInstance = p
    return p
  } catch {
    return null
  }
}

export function useRealtimeChannel(
  userId: string | undefined,
  eventName?: string,
  callback?: (data: any) => void
) {
  const { addNotification, prependActivity, setStats } = useDashboardStore()
  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (!userId) return
    let mounted = true

    getPusher(userId).then((pusher) => {
      if (!pusher || !mounted) return
      
      // We always subscribe to the user's private channel
      // In the future this could be dynamic if we want to support other channels
      const channelName = userId.startsWith("private-") ? userId : `private-user-${userId}`
      
      const channel = pusher.subscribe(channelName)
      channelRef.current = channel

      // If a specific event and callback are provided, bind them
      if (eventName && callback) {
        channel.bind(eventName, (data: any) => {
          if (!mounted) return
          callback(data)
        })
      } else {
        // Otherwise, bind the default dashboard events
        channel.bind("notification.new", (data: any) => {
          if (!mounted) return
          addNotification({
            id: data.id ?? Math.random().toString(36),
            icon: data.icon ?? "🔔",
            title: data.title,
            body: data.body,
            isRead: false,
            type: data.type ?? "SYSTEM",
            actionUrl: data.actionUrl,
            createdAt: data.createdAt ?? new Date().toISOString(),
          })
        })

        channel.bind("activity.new", (data: any) => {
          if (!mounted) return
          prependActivity(data)
        })

        channel.bind("stats.refresh", () => {
          if (!mounted) return
          fetch("/api/dashboard/stats")
            .then((r) => r.json())
            .then(({ data }) => data && setStats(data))
            .catch(() => {})
        })
      }
    })

    return () => {
      mounted = false
      if (userId && pusherInstance) {
        const channelName = userId.startsWith("private-") ? userId : `private-user-${userId}`
        // Don't unsubscribe if we are just a specific event listener, 
        // to avoid killing the main dashboard channel. This is naive but works for our scope.
        if (!eventName) {
          pusherInstance.unsubscribe(channelName)
          channelRef.current = null
        }
      }
    }
  }, [userId, eventName, callback]) // eslint-disable-line
}
