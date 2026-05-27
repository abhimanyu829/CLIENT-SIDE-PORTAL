import "next-auth"
import "next-auth/jwt"

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
    }
  }

  interface User {
    id: string
    role: string
    permissions?: string[]
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
