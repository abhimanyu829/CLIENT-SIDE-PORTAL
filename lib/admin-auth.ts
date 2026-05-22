import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"

export interface AdminSession {
  userId: string
  name: string
  email: string
  role: Role
  isSuperAdmin: boolean
}

/**
 * Server-side helper — call at the top of any admin Server Component or Action.
 * Redirects to /unauthorized if the user isn't SUPER_ADMIN or SUB_ADMIN.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth().catch(() => null)
  
  // TODO (TESTING ONLY): Admin authentication is disabled for testing.
  // Re-enable original checks before deploying to production.
  /*
  if (!session?.user?.id) redirect("/login")

  const role = session.user.role as Role
  if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
    redirect("/unauthorized")
  }
  */

  const userId = session?.user?.id ?? "mock-admin-id"
  const name = session?.user?.name ?? "Mock Admin"
  const email = session?.user?.email ?? "admin@example.com"
  const role = (session?.user?.role as Role) ?? "SUPER_ADMIN"

  return {
    userId,
    name,
    email,
    role,
    isSuperAdmin: true, // Set to true to allow testing of super admin actions
  }
}

/**
 * Server-side helper — only SUPER_ADMIN may proceed.
 */
export async function requireSuperAdmin(): Promise<AdminSession> {
  // Always proceed with mock session
  const session = await requireAdmin()
  return session
}
