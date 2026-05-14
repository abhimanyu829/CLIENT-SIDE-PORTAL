"use client"

import { useState, useEffect, useCallback } from "react"

export interface SubscriptionTier {
  id: string
  name: string
  price: number
  currency: string
  interval: string
  features: string[]
}

export interface UserSubscription {
  id: string
  status: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  tier: SubscriptionTier
  product: { id: string; name: string; slug: string }
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSubscription = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/subscriptions/me")
      if (res.status === 404) {
        setSubscription(null)
        return
      }
      if (!res.ok) throw new Error("Failed to fetch subscription")
      const { data } = await res.json()
      setSubscription(data)
    } catch (err: any) {
      setError(err.message ?? "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const cancelSubscription = useCallback(async () => {
    if (!subscription) return
    const res = await fetch(`/api/subscriptions/${subscription.id}/cancel`, {
      method: "POST",
    })
    if (res.ok) {
      setSubscription((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev)
    } else {
      throw new Error("Cancel failed")
    }
  }, [subscription])

  const reactivate = useCallback(async () => {
    if (!subscription) return
    const res = await fetch(`/api/subscriptions/${subscription.id}/reactivate`, {
      method: "POST",
    })
    if (res.ok) {
      setSubscription((prev) => prev ? { ...prev, cancelAtPeriodEnd: false } : prev)
    } else {
      throw new Error("Reactivate failed")
    }
  }, [subscription])

  const isActive = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING"
  const isCancelling = !!subscription?.cancelAtPeriodEnd
  const isExpired = subscription?.status === "EXPIRED" || subscription?.status === "CANCELLED"

  return {
    subscription,
    isLoading,
    error,
    isActive,
    isCancelling,
    isExpired,
    refetch: fetchSubscription,
    cancelSubscription,
    reactivate,
  }
}
