import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

/**
 * Legacy NextAuth type augmentations — kept for backward compatibility
 * during Clerk migration. New code should use AppUser from lib/auth-types.ts.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      permissions: string[]
      isVerified?: boolean
      avatarUrl?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    role?: string
    isVerified?: boolean
    avatarUrl?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    permissions: string[]
    isVerified?: boolean
    avatarUrl?: string | null
  }
}
