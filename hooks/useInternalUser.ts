"use client"

import { useEffect, useState } from "react"
import type { AppUser } from "@/lib/auth-types"

/**
 * Client-side hook to get the verified internal user from the database.
 * This should be used instead of useUser from Clerk when you need roles/permissions.
 */
export function useInternalUser() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/me")
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        } else {
          setUser(null)
        }
      } catch (err) {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    fetchMe()
  }, [])

  return { user, isLoading }
}
