import { currentUser } from "@clerk/nextjs/server"
import NextAuth, { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GithubProvider from "next-auth/providers/github"
import { getServerSession } from "next-auth/next"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { compare } from "bcryptjs"
import { Role } from "@prisma/client"
import type { AppSession } from "@/lib/auth-types"

// ─────────────────────────────────────────────────────────────────
// LEGACY NextAuth config — kept alive for existing password users
// during Clerk migration. New users go through Clerk.
// ─────────────────────────────────────────────────────────────────
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID || "",
      clientSecret: env.GOOGLE_CLIENT_SECRET || "",
    }),
    GithubProvider({
      clientId: env.GITHUB_CLIENT_ID || "",
      clientSecret: env.GITHUB_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isValidPassword = await compare(
          credentials.password,
          user.passwordHash
        )

        if (!isValidPassword) {
          return null
        }

        if (!user.isVerified) {
          throw new Error(
            "Please verify your email before logging in. Check your inbox for the verification link."
          )
        }

        if (user.isBanned) {
          throw new Error(
            "Your account has been suspended. Please contact support for assistance."
          )
        }

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role as Role
        token.isVerified = (user as any).isVerified as boolean

        const userPermissions = await db.userPermission.findMany({
          where: { userId: user.id },
          include: { permission: true },
        })

        token.permissions = userPermissions.map((up) => up.permission.name)
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.permissions = token.permissions as string[]
        session.user.isVerified = token.isVerified as boolean
      }
      return session
    },
  },
}

// ─────────────────────────────────────────────────────────────────
// UNIFIED auth() — Clerk-first, NextAuth fallback
//
// Call this in every server component, API route, and server action.
// It always returns an AppSession with the INTERNAL userId from DB.
// Authorization (roles, permissions) is ALWAYS sourced from the DB.
// ─────────────────────────────────────────────────────────────────
export const auth = async (): Promise<AppSession | null> => {
  // ── PHASE 1: Clerk (primary) ──────────────────────────────────
  try {
    const clerkUser = await currentUser()

    if (clerkUser) {
      // Lookup by clerkUserId (fast path — already linked)
      let dbUser = await db.user.findUnique({
        where: { clerkUserId: clerkUser.id },
        include: { permissions: { include: { permission: true } } },
      })

      if (!dbUser) {
        // Slow path: email-based lookup (existing user migrating to Clerk)
        const email = clerkUser.emailAddresses[0]?.emailAddress
        if (email) {
          const existing = await db.user.findUnique({
            where: { email },
            include: { permissions: { include: { permission: true } } },
          })

          if (existing && !existing.isBanned) {
            // Auto-link: write clerkUserId to existing record
            dbUser = await db.user.update({
              where: { id: existing.id },
              data: {
                clerkUserId: clerkUser.id,
                isVerified: true,
                lastLoginAt: new Date(),
                // Sync avatar if not set
                ...(existing.avatarUrl ? {} : { avatarUrl: clerkUser.imageUrl ?? undefined }),
              },
              include: { permissions: { include: { permission: true } } },
            })
          } else if (!existing) {
            // Brand-new user: create internal record
            const name =
              [clerkUser.firstName, clerkUser.lastName]
                .filter(Boolean)
                .join(" ") ||
              email
            dbUser = await db.user.create({
              data: {
                email,
                name,
                clerkUserId: clerkUser.id,
                isVerified: true,
                avatarUrl: clerkUser.imageUrl ?? undefined,
                lastLoginAt: new Date(),
              },
              include: { permissions: { include: { permission: true } } },
            })
          }
        }
      }

      if (dbUser && !dbUser.isBanned) {
        return {
          user: {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            isVerified: dbUser.isVerified,
            permissions: dbUser.permissions.map((p: any) => p.permission.name),
            avatarUrl: dbUser.avatarUrl,
            clerkUserId: dbUser.clerkUserId,
          },
        }
      }
    }
  } catch {
    // Clerk unavailable or not in server context — fall through to NextAuth
  }

  // ── PHASE 2: NextAuth fallback (legacy credential users) ──────
  try {
    const nextAuthSession = await getServerSession(authOptions)
    if (nextAuthSession?.user?.id) {
      // Refetch from DB for freshest role/permissions
      const dbUser = await db.user.findUnique({
        where: { id: nextAuthSession.user.id },
        include: { permissions: { include: { permission: true } } },
      })
      if (dbUser && !dbUser.isBanned) {
        return {
          user: {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            isVerified: dbUser.isVerified,
            permissions: dbUser.permissions.map((p: any) => p.permission.name),
            avatarUrl: dbUser.avatarUrl,
            clerkUserId: dbUser.clerkUserId,
          },
        }
      }
    }
  } catch {
    // NextAuth unavailable
  }

  return null
}

/**
 * Zero-trust role guard — always verifies from the database.
 * Use this in any API route or server action that requires specific roles.
 */
export const requireRole = async (allowedRoles: Role[]) => {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Zero-trust: always refetch from DB
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isBanned: true },
  })

  if (!user || user.isBanned) {
    throw new Error("Unauthorized")
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden")
  }

  return user
}
