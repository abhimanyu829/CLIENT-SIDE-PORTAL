"use client"

import { useUser, useAuth as useClerkAuth } from "@clerk/nextjs"
import { useCallback, useEffect, useState } from "react"

export interface AuthUser {
  /** Internal NexusAI DB user ID (UUID) — use for all business logic */
  id: string
  email: string
  name: string | null
  /** DB-sourced role — NEVER from Clerk metadata */
  role: string
  permissions: string[]
  isVerified: boolean
  avatarUrl?: string | null
  phone?: string | null
  clerkUserId?: string | null
}

export function useAuth() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
  const { signOut, isSignedIn } = useClerkAuth()
  const [internalUser, setInternalUser] = useState<AuthUser | null>(null)
  const [isLoadingInternal, setIsLoadingInternal] = useState(true)

  useEffect(() => {
    if (!clerkLoaded) return

    if (!isSignedIn) {
      setInternalUser(null)
      setIsLoadingInternal(false)
      return
    }

    // Fetch authoritative user data from DB via /api/auth/me
    // This is the ONLY source of truth for role and permissions
    setIsLoadingInternal(true)
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch user")
        return r.json()
      })
      .then((data) => {
        if (data.user) setInternalUser(data.user)
      })
      .catch(() => {
        // If /api/auth/me fails, try to sync first then retry
        fetch("/api/auth/clerk-sync", { method: "POST" })
          .then(() => fetch("/api/auth/me"))
          .then((r) => r.json())
          .then((data) => { if (data.user) setInternalUser(data.user) })
          .catch(console.error)
      })
      .finally(() => setIsLoadingInternal(false))
  }, [clerkUser?.id, isSignedIn, clerkLoaded])

  // isAdmin checks DB role — never Clerk metadata
  const isAdmin =
    internalUser?.role === "SUPER_ADMIN" || internalUser?.role === "SUB_ADMIN"
  const isSuperAdmin = internalUser?.role === "SUPER_ADMIN"
  const isAuthenticated = isSignedIn ?? false
  const isLoading = !clerkLoaded || isLoadingInternal

  const logout = useCallback(async () => {
    setInternalUser(null)
    await signOut({ redirectUrl: "/" })
  }, [signOut])

  return {
    user: internalUser,
    clerkUser,
    isLoaded: clerkLoaded && !isLoadingInternal,
    isAuthenticated,
    isLoading,
    isAdmin,
    isSuperAdmin,
    logout,
  }
}
