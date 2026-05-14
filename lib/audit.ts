import { db } from "@/lib/db";
import { NextRequest } from "next/server";

interface AuditLogParams {
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  before?: object;
  after?: object;
  req?: NextRequest;
}

export function auditLog(params: AuditLogParams): void {
  const { userId, action, entity, entityId, before, after, req } = params;

  // Fire-and-forget, non-blocking
  (async () => {
    try {
      let ip: string | undefined;
      let userAgent: string | undefined;

      if (req) {
        ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined
        userAgent = req.headers.get("user-agent") || undefined
      }

      await db.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          beforeJson: before ? JSON.parse(JSON.stringify(before)) : undefined,
          afterJson: after ? JSON.parse(JSON.stringify(after)) : undefined,
          ip,
          userAgent,
        },
      });
    } catch (error) {
      console.error("Failed to write to audit log:", error);
    }
  })();
}
