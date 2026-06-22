"use client"

import { ReactNode } from "react"
import { CartProvider } from "@/providers/CartProvider"
import { ClerkSessionSync } from "@/components/auth/ClerkSessionSync"
import { ThemeProvider } from "@/components/theme/ThemeProvider"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <ClerkSessionSync />
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </CartProvider>
  )
}
