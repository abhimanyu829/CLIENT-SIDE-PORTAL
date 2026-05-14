import { User, Subscription, ProductTier } from "@prisma/client"

// Omit all sensitive / hashed fields before sending to the client
export type SafeUser = Omit<User, "passwordHash" | "twoFactorSecret">

// Minimal public profile (for avatars, mentions, etc.)
export type UserProfile = Pick<User, "id" | "name" | "email" | "avatarUrl" | "role">

// Session user shape — kept here for convenience but type augmentation
// lives in types/next-auth.d.ts to avoid TS2687 duplicate declaration errors
export interface SessionUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string
  permissions: string[]
  avatarUrl?: string | null
}

// User with active subscription + tier
export type UserWithSubscription = SafeUser & {
  subscription:
    | (Subscription & {
        tier: ProductTier
      })
    | null
}

// Admin user list row
export type UserListRow = Pick<User, "id" | "name" | "email" | "role" | "avatarUrl" | "createdAt"> & {
  subscription: { status: string; tier: { name: string } | null } | null
}
