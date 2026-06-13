"use client"

import { ReactNode } from "react"
import { CartProvider } from "@/providers/CartProvider"
import { ClerkSessionSync } from "@/components/auth/ClerkSessionSync"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <ClerkSessionSync />
      {children}
    </CartProvider>
  )
}
