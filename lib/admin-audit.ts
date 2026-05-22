import { db } from "@/lib/db"
import { headers } from "next/headers"

interface AuditLogOptions {
  userId?: string | null
  action: string
  entity?: string
  entityId?: string
  before?: unknown
  after?: unknown
}

/**
 * Creates an immutable audit log entry. Call this on every admin data mutation.
 */
export async function auditLog(opts: AuditLogOptions): Promise<void> {
  try {
    const headerStore = await headers()
    const ip =
      headerStore.get("x-real-ip") ??
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
    const userAgent = headerStore.get("user-agent") ?? undefined

    await db.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        beforeJson: opts.before !== undefined ? (opts.before as object) : undefined,
        afterJson: opts.after !== undefined ? (opts.after as object) : undefined,
        ip,
        userAgent,
      },
    })
  } catch (err) {
    // Never let audit log failure break the main action
    console.error("[auditLog] Failed to write audit entry:", err)
  }
}
