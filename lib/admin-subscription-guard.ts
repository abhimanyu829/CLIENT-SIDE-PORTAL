/**
 * lib/admin-subscription-guard.ts
 *
 * Phase 8 — Server-side RBAC gate for subscription-governance admin routes.
 * SUPER_ADMIN: full access. SUB_ADMIN: requires the SubscriptionGovernance
 * resource with the action from the workforce matrix. Returns null-ish
 * responses via throw-free API — routes map to 401/403.
 */

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { validateSubadminCredentialSession } from "@/lib/subadmin-workforce"
import { canUseSubadminPermission, type SubadminAction } from "@/lib/subadmin-permission-policy"

export type AdminGateResult =
  | { ok: true; userId: string; isSuperAdmin: boolean; name: string }
  | { ok: false; reason: "UNAUTHENTICATED" | "FORBIDDEN" }
  | { ok: false; reason: "FORBIDDEN"; detail: string }

export async function adminSubscriptionGate(action: SubadminAction, resource = "SubscriptionGovernance"): Promise<AdminGateResult> {
  const session = await auth().catch(() => null)
  if (!session?.user?.id) return { ok: false, reason: "UNAUTHENTICATED" }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isBanned: true, name: true },
  })
  if (!user || user.isBanned) return { ok: false, reason: "FORBIDDEN" }
  if (user.role !== "SUPER_ADMIN" && user.role !== "SUB_ADMIN") return { ok: false, reason: "FORBIDDEN" }

  if (user.role === "SUB_ADMIN") {
    const access = await validateSubadminCredentialSession(session.user.id, "SUB_ADMIN")
    if (!access.allowed) return { ok: false, reason: "FORBIDDEN" }
    if (!canUseSubadminPermission(access.permissions, resource as never, action)) {
      return { ok: false, reason: "FORBIDDEN", detail: `requires ${resource}:${action}` }
    }
  }

  return { ok: true, userId: session.user.id, isSuperAdmin: user.role === "SUPER_ADMIN", name: user.name ?? "Admin" }
}