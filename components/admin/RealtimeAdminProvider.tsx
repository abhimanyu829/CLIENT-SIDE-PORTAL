"use client"

import { useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { pusherClient } from "@/lib/pusher-client"

// Event types that trigger admin panel refresh
const REFRESH_EVENTS = new Set([
  "USER_BANNED",
  "USER_UNBANNED",
  "USER_ROLE_CHANGED",
  "SUBSCRIPTION_ACTIVATED",
  "SUBSCRIPTION_CANCELLED",
  "SUBSCRIPTION_PAUSED",
  "SUBSCRIPTION_REACTIVATED",
  "PLAN_CHANGED",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "REFUND_PROCESSED",
  "COUPON_APPLIED",
  "FEATURE_FLAG_TOGGLED",
  "WEBHOOK_RECEIVED",
  "WEBHOOK_DEAD",
  "FRAUD_FLAGGED",
  "QUOTA_EXCEEDED",
])

// Events that show toast notifications to admin
const ALERT_EVENTS: Record<string, { title: string; description: (p: any) => string; variant?: "destructive" }> = {
  USER_BANNED: {
    title: "🚫 User Banned",
    description: (p) => `User ${p.email} has been banned`,
  },
  USER_UNBANNED: {
    title: "✅ User Unbanned",
    description: (p) => `User ${p.email} access restored`,
  },
  REFUND_PROCESSED: {
    title: "💸 Refund Processed",
    description: (p) => `$${p.amount?.toFixed(2)} refunded for payment ${p.paymentId}`,
  },
  PLAN_CHANGED: {
    title: "🔄 Plan Changed",
    description: (p) => `Subscription ${p.subscriptionId} plan updated`,
  },
  FRAUD_FLAGGED: {
    title: "⚠️ Fraud Flagged",
    description: (p) => `User ${p.email ?? p.userId} flagged for fraud review`,
    variant: "destructive",
  },
  QUOTA_EXCEEDED: {
    title: "⚡ Quota Exceeded",
    description: (p) => `User ${p.userId} exceeded AI token limit (${p.dailyLimit?.toLocaleString()} tokens/day)`,
    variant: "destructive",
  },
  WEBHOOK_DEAD: {
    title: "💀 Webhook Dead",
    description: (p) => `Webhook ${p.webhookEventId} moved to dead-letter queue`,
    variant: "destructive",
  },
  FEATURE_FLAG_TOGGLED: {
    title: "🚩 Feature Flag Toggled",
    description: (p) => `Flag "${p.flagName}" set to ${p.isEnabled ? "ENABLED" : "DISABLED"}`,
  },
  SUBSCRIPTION_CANCELLED: {
    title: "❌ Subscription Cancelled",
    description: (p) => `Subscription ${p.subscriptionId} cancelled`,
    variant: "destructive",
  },
  PAYMENT_SUCCESS: {
    title: "💰 Payment Received",
    description: (p) => `New payment from user ${p.userId}`,
  },
}

interface Props {
  children: React.ReactNode
}

/**
 * RealtimeAdminProvider
 *
 * Subscribes to the `admin-dashboard` Pusher channel and:
 *  1. Shows toast notifications for critical admin events
 *  2. Triggers router.refresh() to update server components with fresh data
 *
 * Wrap the admin layout with this component.
 */
export default function RealtimeAdminProvider({ children }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const channelRef = useRef<ReturnType<typeof pusherClient.subscribe> | null>(null)
  const refreshDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedRefresh = useCallback(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
    refreshDebounceRef.current = setTimeout(() => {
      router.refresh()
    }, 1500) // Debounce 1.5s to batch rapid updates
  }, [router])

  useEffect(() => {
    // Subscribe to admin-dashboard channel
    const channel = pusherClient.subscribe("admin-dashboard")
    channelRef.current = channel

    // Bind to ALL events we care about
    const allEvents = [
      ...Array.from(REFRESH_EVENTS),
      ...Object.keys(ALERT_EVENTS),
    ]
    const uniqueEvents = [...new Set(allEvents)]

    uniqueEvents.forEach((eventType) => {
      channel.bind(eventType, (data: { type: string; payload: Record<string, unknown> }) => {
        const payload = data?.payload ?? {}

        // Show toast for alert events
        const alertConfig = ALERT_EVENTS[eventType]
        if (alertConfig) {
          toast({
            title: alertConfig.title,
            description: alertConfig.description(payload),
            variant: alertConfig.variant ?? "default",
          })
        }

        // Refresh data for events that affect UI state
        if (REFRESH_EVENTS.has(eventType)) {
          debouncedRefresh()
        }
      })
    })

    return () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
      uniqueEvents.forEach((eventType) => channel.unbind(eventType))
      pusherClient.unsubscribe("admin-dashboard")
      channelRef.current = null
    }
  }, [debouncedRefresh, toast])

  return <>{children}</>
}
