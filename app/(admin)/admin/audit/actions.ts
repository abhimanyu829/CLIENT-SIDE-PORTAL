"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { Role } from "@prisma/client"
import { auditLog } from "@/lib/admin-audit"
import crypto from "crypto"

export async function revokeSession(sessionId: string) {
  const session = await auth()
  if (!session?.user || !session.user.role?.includes("ADMIN")) throw new Error("Unauthorized")

  const targetSession = await db.userSession.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })
  if (!targetSession) throw new Error("Session not found")

  await db.userSession.delete({ where: { id: sessionId } })

  await auditLog({
    userId: session.user.id,
    action: "SESSION_REVOKED",
    entity: "UserSession",
    entityId: sessionId,
    after: { revokedUser: targetSession.user.email },
  })

  revalidatePath("/admin/audit")
}

export async function updateAdminRole(data: {
  userId: string
  role: Role
  department: string | null
  permissions: string[]
}) {
  const session = await auth()
  if (!session?.user || !session.user.role?.includes("SUPER_ADMIN")) {
    throw new Error("Only Superadmins can update RBAC permissions")
  }

  const before = await db.user.findUnique({
    where: { id: data.userId },
    select: { id: true, role: true, department: data.department ? true : false, permissions: { select: { permission: { select: { name: true } } } } },
  })

  // 1. Delete all previous permissions in the join table
  await db.userPermission.deleteMany({
    where: { userId: data.userId }
  })

  // 2. Fetch or create the specific Permission models
  const permissionModels = await Promise.all(
    data.permissions.map(async (name) => {
      let perm = await db.permission.findUnique({ where: { name } })
      if (!perm) {
        // Create matching permissions if missing
        perm = await db.permission.create({
          data: {
            name,
            action: name.split("_")[0] || "read",
            resource: name.split("_")[1] || "all",
            description: `Auto-generated permission for ${name}`
          }
        })
      }
      return perm
    })
  )

  // 3. Connect permissions
  if (permissionModels.length > 0) {
    await db.userPermission.createMany({
      data: permissionModels.map(p => ({
        userId: data.userId,
        permissionId: p.id,
        grantedBy: session.user.id
      }))
    })
  }

  // 4. Update core user fields
  const updatedUser = await db.user.update({
    where: { id: data.userId },
    data: {
      role: data.role,
      department: data.department as any || null,
    },
  })

  await auditLog({
    userId: session.user.id,
    action: "RBAC_USER_UPDATED",
    entity: "User",
    entityId: data.userId,
    before: before ? {
      role: before.role,
      department: before.department,
      permissions: before.permissions.map(p => p.permission.name)
    } : undefined,
    after: { role: data.role, department: data.department, permissions: data.permissions },
  })

  revalidatePath("/admin/audit")
  revalidatePath("/admin/users")
  return updatedUser
}

export async function createApiKey(data: {
  name: string
  rateLimit: number
  expiresAt: string | null
}) {
  const session = await auth()
  if (!session?.user || !session.user.role?.includes("ADMIN")) throw new Error("Unauthorized")

  // Generate a random high-entropy API key
  const rawKey = `abhi_${crypto.randomBytes(24).toString("hex")}`
  const prefix = rawKey.substring(0, 8)

  const apiKey = await db.apiKey.create({
    data: {
      userId: session.user.id,
      key: rawKey,
      prefix,
      name: data.name,
      rateLimit: data.rateLimit,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
    },
  })

  await auditLog({
    userId: session.user.id,
    action: "API_KEY_CREATED",
    entity: "ApiKey",
    entityId: apiKey.id,
    after: { name: data.name, prefix },
  })

  revalidatePath("/admin/audit")
  return apiKey
}

export async function revokeApiKey(keyId: string) {
  const session = await auth()
  if (!session?.user || !session.user.role?.includes("ADMIN")) throw new Error("Unauthorized")

  const key = await db.apiKey.findUnique({ where: { id: keyId } })
  if (!key) throw new Error("API Key not found")

  await db.apiKey.update({
    where: { id: keyId },
    data: { isActive: false },
  })

  await auditLog({
    userId: session.user.id,
    action: "API_KEY_REVOKED",
    entity: "ApiKey",
    entityId: keyId,
    before: { isActive: true },
    after: { isActive: false },
  })

  revalidatePath("/admin/audit")
}
