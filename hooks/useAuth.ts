"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useCallback } from "react"

export interface AuthUser {
  id: string
  name: string
  email: string
  image?: string
  role: string
}

export function useAuth() {
  const { data: session, status } = useSession()

  const user: AuthUser | null = session?.user
    ? {
        id: session.user.id as string,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        image: session.user.image ?? undefined,
        role: (session.user as any).role ?? "CLIENT",
      }
    : null

  const isAuthenticated = status === "authenticated"
  const isLoading = status === "loading"
  const isAdmin = user?.role === "ADMIN"

  const login = useCallback(
    async (provider?: string, credentials?: { email: string; password: string }) => {
      if (provider) {
        return signIn(provider, { callbackUrl: "/dashboard" })
      }
      if (credentials) {
        return signIn("credentials", {
          ...credentials,
          callbackUrl: "/dashboard",
        })
      }
    },
    []
  )

  const logout = useCallback(async () => {
    return signOut({ callbackUrl: "/" })
  }, [])

  return {
    user,
    session,
    status,
    isAuthenticated,
    isLoading,
    isAdmin,
    login,
    logout,
  }
}
