import { auth } from "@/lib/auth"

// ── RBAC permission matrix ────────────────────────────────────────────────────
// Format: "action:resource"
// ADMIN role bypasses all checks; roles below accumulate upward

export const PERMISSIONS = {
  // Users
  READ_USERS: "read:users",
  WRITE_USERS: "write:users",
  DELETE_USERS: "delete:users",

  // Products
  READ_PRODUCTS: "read:products",
  WRITE_PRODUCTS: "write:products",
  DELETE_PRODUCTS: "delete:products",

  // Tickets
  READ_TICKETS: "read:tickets",
  WRITE_TICKETS: "write:tickets",
  MANAGE_TICKETS: "manage:tickets", // reassign, close, internal notes
  DELETE_TICKETS: "delete:tickets",

  // Billing
  READ_BILLING: "read:billing",
  MANAGE_BILLING: "manage:billing",

  // CRM
  READ_CRM: "read:crm",
  WRITE_CRM: "write:crm",

  // Audit
  READ_AUDIT: "read:audit",

  // Analytics
  READ_ANALYTICS: "read:analytics",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Default permission sets per role
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  CLIENT: [
    PERMISSIONS.READ_PRODUCTS,
    PERMISSIONS.READ_TICKETS,
    PERMISSIONS.WRITE_TICKETS,
    PERMISSIONS.READ_BILLING,
  ],
  STAFF: [
    PERMISSIONS.READ_PRODUCTS,
    PERMISSIONS.READ_TICKETS,
    PERMISSIONS.WRITE_TICKETS,
    PERMISSIONS.MANAGE_TICKETS,
    PERMISSIONS.READ_USERS,
    PERMISSIONS.READ_CRM,
    PERMISSIONS.WRITE_CRM,
    PERMISSIONS.READ_BILLING,
  ],
  ADMIN: Object.values(PERMISSIONS) as Permission[],
}

// ── Server-side helpers ───────────────────────────────────────────────────────

/**
 * Checks if a session user has a given permission.
 * ADMIN role always returns true.
 */
export function hasPermission(
  sessionUser: { role?: string; permissions?: string[] } | null | undefined,
  permission: Permission
): boolean {
  if (!sessionUser) return false
  if (sessionUser.role === "ADMIN") return true
  return sessionUser.permissions?.includes(permission) ?? false
}

/**
 * Resolves the default permissions for a given role.
 */
export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Server action / API route guard.
 * Throws a 403 error if the current session user lacks the required permission.
 */
export async function requirePermission(permission: Permission): Promise<void> {
  const session = await auth()
  const user = session?.user as { role?: string; permissions?: string[] } | undefined

  if (!hasPermission(user, permission)) {
    throw new Error(`Forbidden: missing permission '${permission}'`)
  }
}

/**
 * Returns true if the user has ALL of the specified permissions.
 */
export function hasAllPermissions(
  sessionUser: { role?: string; permissions?: string[] } | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(sessionUser, p))
}

/**
 * Returns true if the user has ANY of the specified permissions.
 */
export function hasAnyPermission(
  sessionUser: { role?: string; permissions?: string[] } | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(sessionUser, p))
}
