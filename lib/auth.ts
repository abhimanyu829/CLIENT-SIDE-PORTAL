import { currentUser } from "@clerk/nextjs/server"
import { Role } from "@prisma/client"
import type { AppSession } from "@/lib/auth-types"
import { db } from "@/lib/db"
import { profileFromCurrentClerkUser, syncClerkUserToDatabase, type SyncedClerkUser } from "@/lib/services/clerk-user-sync"

function toAppSession(dbUser: SyncedClerkUser): AppSession {
  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      isVerified: dbUser.isVerified,
      permissions: dbUser.permissions.map((p) => p.permission.name),
      avatarUrl: dbUser.avatarUrl,
      clerkUserId: dbUser.clerkUserId,
    },
  }
}

export const auth = async (): Promise<AppSession | null> => {
  try {
    const profile = profileFromCurrentClerkUser(await currentUser())
    if (!profile) return null

    const dbUser = await syncClerkUserToDatabase(profile, { updateLastLogin: true })
    if (dbUser.isBanned) return null

    return toAppSession(dbUser)
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Clerk auth failed:", error)
    }
    return null
  }
}

export const requireRole = async (allowedRoles: Role[]) => {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isBanned: true },
  })

  if (!dbUser || dbUser.isBanned) {
    throw new Error("Unauthorized")
  }

  if (!allowedRoles.includes(dbUser.role)) {
    throw new Error("Forbidden")
  }

  return dbUser
}
