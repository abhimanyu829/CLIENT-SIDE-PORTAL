"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth as useAppAuth } from "@/hooks/useAuth"
import { pusherClient } from "@/lib/pusher-client"

export interface CartItem {
  id: string
  productId: string
  tierId?: string | null
  productName: string
  productSlug?: string
  thumbnailUrl?: string | null
  quantity: number
  unitPrice: number
  currency: string
}

export interface CartData {
  id: string
  items: CartItem[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  grandTotal: number
  currency: string
  couponCode?: string | null
}

interface CartSyncState {
  cart: CartData | null
  itemCount: number
  isLoading: boolean
  error: string | null
}

export function useCartSync() {
  const { user: internalUser, isAuthenticated, isLoading: authLoading } = useAppAuth()
  const [userId, setUserId] = useState<string | null>(internalUser?.id ?? null)
  const [state, setState] = useState<CartSyncState>({
    cart: null,
    itemCount: 0,
    isLoading: false,
    error: null,
  })
  const channelRef = useRef<any>(null)
  const resolveCurrentUserId = useCallback(async () => {
    if (internalUser?.id) {
      setUserId(internalUser.id)
      return internalUser.id
    }

    if (!isAuthenticated) {
      setUserId(null)
      return null
    }

    try {
      const res = await fetch("/api/auth/me")
      if (!res.ok) {
        setUserId(null)
        return null
      }

      const data = await res.json()
      const resolvedUserId = data?.user?.id ?? null
      setUserId(resolvedUserId)
      return resolvedUserId
    } catch {
      setUserId(null)
      return null
    }
  }, [internalUser?.id, isAuthenticated])

  const fetchCart = useCallback(async () => {
    const resolvedUserId = userId ?? await resolveCurrentUserId()
    if (!resolvedUserId) {
      setState({ cart: null, itemCount: 0, isLoading: false, error: null })
      return
    }
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const res = await fetch("/api/cart")
      if (res.ok) {
        const { data } = await res.json()
        const items = data?.items ?? []
        const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity ?? 1), 0)
        setState({
          cart: data ? {
            id: data.id,
            items: items.map((item: any) => ({
              id: item.id,
              productId: item.productId,
              tierId: item.tierId,
              productName: item.product?.name ?? "Product",
              productSlug: item.product?.slug,
              thumbnailUrl: item.product?.thumbnailUrl,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              currency: item.currency ?? "USD",
            })),
            subtotal: Number(data.subtotal ?? 0),
            discountTotal: Number(data.discountTotal ?? 0),
            taxTotal: Number(data.taxTotal ?? 0),
            grandTotal: Number(data.grandTotal ?? 0),
            currency: data.currency ?? "USD",
            couponCode: data.couponCode,
          } : null,
          itemCount,
          isLoading: false,
          error: null,
        })
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
      }
    } catch {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [userId, resolveCurrentUserId])

  // Subscribe to Pusher channel for realtime updates
  useEffect(() => {
    if (!userId || !pusherClient) {
      return
    }

    const channelName = `private-user-${userId}`
    const channel = pusherClient.subscribe(channelName)
    channelRef.current = channel

    const handleCartUpdate = () => {
      fetchCart()
    }

    const handleOrderPaid = () => {
      // Cart may be converted after payment — refresh
      fetchCart()
    }

    channel.bind("CART_UPDATED", handleCartUpdate)
    channel.bind("ORDER_PAID", handleOrderPaid)
    channel.bind("billing.refresh", handleCartUpdate)

    return () => {
      channel.unbind("CART_UPDATED", handleCartUpdate)
      channel.unbind("ORDER_PAID", handleOrderPaid)
      channel.unbind("billing.refresh", handleCartUpdate)
      pusherClient.unsubscribe(channelName)
      channelRef.current = null
    }
  }, [userId, fetchCart])

  // Cross-tab sync via storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "cart-sync") {
        fetchCart()
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [fetchCart])

  // Initial fetch when session loads
  useEffect(() => {
    if (internalUser?.id) {
      setUserId(internalUser.id)
      fetchCart()
      return
    }

    if (!authLoading && isAuthenticated) {
      resolveCurrentUserId().then((resolvedUserId) => {
        if (resolvedUserId) {
          fetchCart()
        }
      })
      return
    }

    if (!authLoading && !isAuthenticated) {
      setUserId(null)
      setState({ cart: null, itemCount: 0, isLoading: false, error: null })
    }
  }, [internalUser?.id, authLoading, isAuthenticated, fetchCart, resolveCurrentUserId])

  const addItem = useCallback(async (productId: string, tierId?: string, quantity = 1) => {
    const resolvedUserId = userId ?? await resolveCurrentUserId()
    if (!resolvedUserId) return { success: false, error: "UNAUTHORIZED", code: "UNAUTHORIZED" }
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, tierId, quantity }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState(prev => ({ ...prev, isLoading: false, error: data.error }))
        return { success: false, error: data.error, code: data.code }
      }
      // Optimistic update + server refresh
      await fetchCart()
      // Notify other tabs
      localStorage.setItem("cart-sync", Date.now().toString())
      return { success: true }
    } catch {
      setState(prev => ({ ...prev, isLoading: false, error: "Failed to add item" }))
      return { success: false, error: "Failed to add item" }
    }
  }, [userId, fetchCart, resolveCurrentUserId])

  const removeItem = useCallback(async (itemId: string) => {
    const resolvedUserId = userId ?? await resolveCurrentUserId()
    if (!resolvedUserId) return
    try {
      await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_quantity", itemId, quantity: 0 }),
      })
      await fetchCart()
      localStorage.setItem("cart-sync", Date.now().toString())
    } catch {
      // Silently fail — will refresh on next fetch
    }
  }, [userId, fetchCart, resolveCurrentUserId])

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    const resolvedUserId = userId ?? await resolveCurrentUserId()
    if (!resolvedUserId) return
    try {
      await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_quantity", itemId, quantity }),
      })
      await fetchCart()
      localStorage.setItem("cart-sync", Date.now().toString())
    } catch {
      // Silently fail
    }
  }, [userId, fetchCart, resolveCurrentUserId])

  const clearCart = useCallback(async () => {
    const resolvedUserId = userId ?? await resolveCurrentUserId()
    if (!resolvedUserId) return
    try {
      await fetch("/api/cart", { method: "DELETE" })
      setState({ cart: null, itemCount: 0, isLoading: false, error: null })
      localStorage.setItem("cart-sync", Date.now().toString())
    } catch {
      // Silently fail
    }
  }, [userId, resolveCurrentUserId])

  return {
    ...state,
    fetchCart,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  }
}
