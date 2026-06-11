import type { Role } from "@prisma/client"

/**
 * Unified application user — sourced from DB, never from JWT claims alone.
 * This is the single source of truth for identity inside NexusAI.
 */
export interface AppUser {
  /** Internal DB primary key (UUID). Use this for ALL business logic. */
  id: string
  email: string
  name: string | null
  /** Role sourced from PostgreSQL — Clerk metadata is NEVER used for authorization. */
  role: Role
  isVerified: boolean
  permissions: string[]
  avatarUrl?: string | null
  /** Clerk user ID — only for auth layer. Never use as FK in business tables. */
  clerkUserId?: string | null
}

export interface AppSession {
  user: AppUser
}
