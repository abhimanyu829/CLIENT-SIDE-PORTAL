import { db } from "@/lib/db";
import { NextRequest } from "next/server";

// Auth event types for audit logging
export const AUTH_EVENTS = {
  SIGNUP: "AUTH_SIGNUP",
  LOGIN: "AUTH_LOGIN",
  LOGOUT: "AUTH_LOGOUT",
  LOGIN_FAILED: "AUTH_LOGIN_FAILED",
  ROLE_CHANGED: "ROLE_CHANGED",
  PASSWORD_RESET: "AUTH_PASSWORD_RESET",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  USER_BANNED: "USER_BANNED",
  USER_UNBANNED: "USER_UNBANNED",
} as const;

interface AuditLogParams {
  userId?: string;
  clerkUserId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  before?: object;
  after?: object;
  metadata?: object;
  req?: NextRequest;
}

export function auditLog(params: AuditLogParams): void {
  const { userId, clerkUserId, action, entity, entityId, before, after, metadata, req } = params;

  // Fire-and-forget, non-blocking
  (async () => {
    try {
      let ip: string | undefined;
      let userAgent: string | undefined;

      if (req) {
        ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
        userAgent = req.headers.get("user-agent") || undefined;
      }

      await db.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          beforeJson: before ? JSON.parse(JSON.stringify(before)) : undefined,
          afterJson: after
            ? JSON.parse(JSON.stringify(after))
            : metadata
            ? JSON.parse(JSON.stringify(metadata))
            : undefined,
          ip,
          userAgent,
        },
      });
    } catch (error) {
      console.error("Failed to write to audit log:", error);
    }
  })();
}
