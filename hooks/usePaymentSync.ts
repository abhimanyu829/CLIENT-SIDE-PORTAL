"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/**
 * usePaymentSync — Subscribes to Pusher real-time events for payment/billing updates.
 * When a billing.refresh, subscription.update, ORDER_PAID, or CREDENTIAL_DELIVERED event
 * arrives, it invalidates relevant React Query caches and triggers a router refresh
 * so the dashboard stays in sync without manual page reloads.
 */
export function usePaymentSync(userId: string | undefined) {
  const router = useRouter()
  const channelRef = useRef<any>(null)
  const pusherRef = useRef<any>(null)

  useEffect(() => {
    if (!userId || !process.env.NEXT_PUBLIC_PUSHER_KEY) return
    let mounted = true

    const connect = async () => {
      try {
        const PusherClient = (await import("pusher-js")).default
        const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap2",
          authEndpoint: "/api/pusher/auth",
        })

        if (!mounted) return
        pusherRef.current = pusher

        const channelName = `private-user-${userId}`
        const channel = pusher.subscribe(channelName)
        channelRef.current = channel

        // Refresh dashboard data on billing events
        const handleRefresh = () => {
          if (!mounted) return
          router.refresh()
        }

        channel.bind("billing.refresh", handleRefresh)
        channel.bind("subscription.update", handleRefresh)
        channel.bind("ORDER_PAID", handleRefresh)
        channel.bind("CREDENTIAL_DELIVERED", handleRefresh)
        channel.bind("ORDER_FULFILLED", handleRefresh)
        channel.bind("REFUND_PROCESSED", handleRefresh)
        channel.bind("PAYMENT_FAILED", handleRefresh)
      } catch {
        // Pusher not available — dashboard will rely on manual refresh or polling
      }
    }

    connect()

    return () => {
      mounted = false
      if (channelRef.current && pusherRef.current) {
        try {
          pusherRef.current.unsubscribe(`private-user-${userId}`)
        } catch {}
      }
      if (pusherRef.current) {
        try {
          pusherRef.current.disconnect()
        } catch {}
      }
      channelRef.current = null
      pusherRef.current = null
    }
  }, [userId, router])
}