import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"
import { db } from "@/lib/db"

export interface AdminSession {
  userId: string
  name: string
  email: string
  role: Role
  isSuperAdmin: boolean
}

/**
 * Server-side helper — call at the top of any admin Server Component or Action.
 * Zero-trust: role is always fetched from the database, never trusted from JWT alone.
 * Redirects to /login if unauthenticated, /unauthorized if insufficient role.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth().catch(() => null)

  if (!session?.user?.id) {
    redirect("/login")
  }

  // Zero-trust: refetch role from DB — never trust token claims alone
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isBanned: true, name: true, email: true },
  })

  if (!user) redirect("/login")
  if (user.isBanned) redirect("/unauthorized")

  const role = user.role as Role
  if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
    redirect("/unauthorized")
  }

  return {
    userId: session.user.id,
    name: user.name ?? session.user.name ?? "Admin",
    email: user.email ?? session.user.email ?? "",
    role,
    isSuperAdmin: role === "SUPER_ADMIN",
  }
}

/**
 * Server-side helper — SUPER_ADMIN only.
 * SUB_ADMIN is denied and redirected to /unauthorized.
 */
export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await auth().catch(() => null)

  if (!session?.user?.id) {
    redirect("/login")
  }

  // Zero-trust: refetch role from DB
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isBanned: true, name: true, email: true },
  })

  if (!user) redirect("/login")
  if (user.isBanned) redirect("/unauthorized")

  if (user.role !== "SUPER_ADMIN") {
    redirect("/unauthorized")
  }

  return {
    userId: session.user.id,
    name: user.name ?? session.user.name ?? "Super Admin",
    email: user.email ?? session.user.email ?? "",
    role: user.role as Role,
    isSuperAdmin: true,
  }
}

const SERVICE_CENTER_PERMISSION_PREFIX = "manage:service-center:"

async function hasPermission(userId: string, permissionName: string) {
  const permission = await db.permission.findUnique({
    where: { name: permissionName },
    select: { id: true },
  })
  if (!permission) return false

  const grant = await db.userPermission.findUnique({
    where: {
      userId_permissionId: {
        userId,
        permissionId: permission.id,
      },
    },
    select: { userId: true },
  })

  return !!grant
}

export async function requireServicePermission(permissionName: string): Promise<AdminSession> {
  const session = await requireAdmin()
  if (session.isSuperAdmin) return session

  const allowed = await hasPermission(session.userId, permissionName)
  if (!allowed) redirect("/unauthorized")
  return session
}

export async function requireServiceCenterAccess(centerSlug: string): Promise<AdminSession> {
  return requireServicePermission(`${SERVICE_CENTER_PERMISSION_PREFIX}${centerSlug}`)
}

export async function requireServiceOperationsAccess(area: "emails" | "analytics" | "orders" | "requests") {
  return requireServicePermission(`manage:service:${area}`)
}
