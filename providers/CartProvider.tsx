"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useCartSync, type CartData, type CartItem } from "@/hooks/useCartSync"

interface CartContextValue {
  cart: CartData | null
  itemCount: number
  isLoading: boolean
  error: string | null
  fetchCart: () => Promise<void>
  addItem: (productId: string, tierId?: string, quantity?: number) => Promise<{ success: boolean; error?: string; code?: string }>
  removeItem: (itemId: string) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const cartSync = useCartSync()
  return <CartContext.Provider value={cartSync}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}