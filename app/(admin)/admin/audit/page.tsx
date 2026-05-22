import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-auth"
import AdminAuditClient from "./AdminAuditClient"

export default async function AdminAuditPage() {
  const admin = await requireAdmin()

  const [logs, sessions, apiKeys, adminUsers] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    db.userSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    db.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    db.user.findMany({
      where: {
        role: { in: ["SUPER_ADMIN", "SUB_ADMIN", "GUEST"] },
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      },
      orderBy: { email: "asc" },
    }),
  ])

  // Convert objects for boundary safety
  const serializedLogs = logs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
    beforeJson: log.beforeJson ? JSON.parse(JSON.stringify(log.beforeJson)) : null,
    afterJson: log.afterJson ? JSON.parse(JSON.stringify(log.afterJson)) : null,
  }))

  const serializedSessions = sessions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    expires: s.expiresAt.toISOString(),
  }))

  const serializedApiKeys = apiKeys.map((k) => ({
    ...k,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
  }))

  const serializedAdminUsers = adminUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department ? String(u.department) : null,
    permissions: u.permissions.map((p) => p.permission.name),
  }))

  return (
    <AdminAuditClient
      initialLogs={serializedLogs}
      sessions={serializedSessions}
      apiKeys={serializedApiKeys}
      adminUsers={serializedAdminUsers}
      isSuperAdmin={admin.isSuperAdmin}
    />
  )
}
