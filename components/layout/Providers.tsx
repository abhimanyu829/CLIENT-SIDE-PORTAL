"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { CartProvider } from "@/providers/CartProvider"

/**
 * Client-side providers wrapper.
 * Add any other context providers here (ThemeProvider, ToastProvider, etc.)
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        {children}
      </CartProvider>
    </SessionProvider>
  )
}
