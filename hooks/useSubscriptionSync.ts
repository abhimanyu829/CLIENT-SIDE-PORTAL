"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRealtimeChannel } from "./useRealtimeChannel"

interface SubscriptionEvent {
  type: "SUBSCRIPTION_CREATED" | "SUBSCRIPTION_UPDATED" | "SUBSCRIPTION_CANCELLED" | "SUBSCRIPTION_EXPIRED" | "SUBSCRIPTION_PAST_DUE" | "SUBSCRIPTION_RESUMED" | "PAYMENT_FAILED" | "PAYMENT_SUCCEEDED"
  subscriptionId: string
  data?: Record<string, any>
}

interface UseSubscriptionSyncOptions {
  userId?: string
  onSubscriptionChange?: (event: SubscriptionEvent) => void
  onPaymentFailed?: (subscriptionId: string) => void
  onExpiryWarning?: (subscriptionId: string, daysLeft: number) => void
}

export function useSubscriptionSync({
  userId,
  onSubscriptionChange,
  onPaymentFailed,
  onExpiryWarning,
}: UseSubscriptionSyncOptions) {
  const callbacksRef = useRef({ onSubscriptionChange, onPaymentFailed, onExpiryWarning })
  callbacksRef.current = { onSubscriptionChange, onPaymentFailed, onExpiryWarning }

  const handleEvent = useCallback((data: SubscriptionEvent) => {
    const cbs = callbacksRef.current

    cbs.onSubscriptionChange?.(data)

    if (data.type === "PAYMENT_FAILED") {
      cbs.onPaymentFailed?.(data.subscriptionId)
    }

    if (data.type === "SUBSCRIPTION_EXPIRED" && data.data?.daysLeft) {
      cbs.onExpiryWarning?.(data.subscriptionId, data.data.daysLeft)
    }
  }, [])

  useRealtimeChannel(userId, "subscription.update", handleEvent)
}

interface PreviewEvent {
  type: "PREVIEW_STARTED" | "PREVIEW_EXPIRING" | "PREVIEW_EXPIRED" | "PREVIEW_REVOKED"
  sessionId: string
  data?: Record<string, any>
}

interface UsePreviewSyncOptions {
  userId?: string
  onPreviewExpiring?: (sessionId: string, minutesLeft: number) => void
  onPreviewExpired?: (sessionId: string) => void
  onPreviewRevoked?: (sessionId: string) => void
}

export function usePreviewSync({
  userId,
  onPreviewExpiring,
  onPreviewExpired,
  onPreviewRevoked,
}: UsePreviewSyncOptions) {
  const callbacksRef = useRef({ onPreviewExpiring, onPreviewExpired, onPreviewRevoked })
  callbacksRef.current = { onPreviewExpiring, onPreviewExpired, onPreviewRevoked }

  const handleEvent = useCallback((data: PreviewEvent) => {
    const cbs = callbacksRef.current

    if (data.type === "PREVIEW_EXPIRING" && data.data?.minutesLeft) {
      cbs.onPreviewExpiring?.(data.sessionId, data.data.minutesLeft)
    }
    if (data.type === "PREVIEW_EXPIRED") {
      cbs.onPreviewExpired?.(data.sessionId)
    }
    if (data.type === "PREVIEW_REVOKED") {
      cbs.onPreviewRevoked?.(data.sessionId)
    }
  }, [])

  useRealtimeChannel(userId, "preview.update", handleEvent)
}