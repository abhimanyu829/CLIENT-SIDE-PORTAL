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

/**
 * Server-side helper: returns the current session.
 * Import this in server components and API routes.
 * Usage: const session = await auth()
 */
export const auth = () => getServerSession(authOptions)
