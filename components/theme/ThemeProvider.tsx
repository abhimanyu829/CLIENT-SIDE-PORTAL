"use client"

import type { ReactNode } from "react"

type ThemeProviderProps = {
  children: ReactNode
  [key: string]: unknown
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <>{children}</>
}
