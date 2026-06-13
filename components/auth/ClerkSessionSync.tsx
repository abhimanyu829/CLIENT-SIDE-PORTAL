"use client"

import { useEffect, useRef } from "react"
import { useUser } from "@clerk/nextjs"

export function ClerkSessionSync() {
  const { isLoaded, isSignedIn, user } = useUser()
  const syncedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return
    if (syncedUserId.current === user.id) return

    const storageKey = `nexusai:clerk-sync:${user.id}`
    try {
      if (window.sessionStorage.getItem(storageKey)) {
        syncedUserId.current = user.id
        return
      }
      window.sessionStorage.setItem(storageKey, "1")
    } catch {
      // Session storage can be unavailable in hardened environments.
    }

    syncedUserId.current = user.id

    fetch("/api/auth/clerk-sync", { method: "POST" }).catch(() => {
      try {
        window.sessionStorage.removeItem(storageKey)
      } catch {
        // Ignore storage cleanup errors.
      }
      syncedUserId.current = null
    })
  }, [isLoaded, isSignedIn, user?.id])

  return null
}
