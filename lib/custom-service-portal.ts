import { randomUUID } from "crypto"
import { Prisma, type CustomServiceRequestStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"
import { enqueueEmail } from "@/lib/email/service"
import { getPusherServer } from "@/lib/pusher"

export const CUSTOM_SERVICE_PORTAL_ID = "custom-service-portal"
export const CUSTOM_SERVICE_STATUSES: CustomServiceRequestStatus[] = ["NEW", "UNDER_REVIEW", "DISCUSSION", "PROPOSAL_SENT", "APPROVED", "IN_DEVELOPMENT", "COMPLETED", "CLOSED"]
export const ALLOWED_ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/x-zip-compressed"])
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

export async function getCustomServicePortalSetting() {
  return db.customServicePortalSetting.upsert({
    where: { id: CUSTOM_SERVICE_PORTAL_ID }, update: {}, create: { id: CUSTOM_SERVICE_PORTAL_ID },
  })
}

export async function isCustomServiceAdmin(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, isBanned: true } })
  return !!user && !user.isBanned && (user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN")
}

export async function assertCustomServiceRequestAccess(requestId: string, userId: string) {
  const request = await db.customServiceRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new Error("REQUEST_NOT_FOUND")
  if (request.clientId === userId) return { request, isAdmin: false }
  if (await isCustomServiceAdmin(userId)) return { request, isAdmin: true }
  throw new Error("FORBIDDEN")
}

export function makeCustomServiceRequestNumber() {
  return `CSR-${new Date().getUTCFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

export function normalizeAttachment(input: { fileName: string; mimeType: string; sizeBytes: number; storageKey: string; url: string }, userId: string) {
  if (!ALLOWED_ATTACHMENT_TYPES.has(input.mimeType)) throw new Error("UNSUPPORTED_ATTACHMENT_TYPE")
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > MAX_ATTACHMENT_BYTES) throw new Error("INVALID_ATTACHMENT_SIZE")
  if (!input.storageKey.startsWith(`service-requests/${userId}/`)) throw new Error("INVALID_ATTACHMENT_OWNERSHIP")
  if (!input.fileName.trim() || input.fileName.length > 200 || !input.url.trim()) throw new Error("INVALID_ATTACHMENT")
  return { fileName: input.fileName.trim(), mimeType: input.mimeType, sizeBytes: input.sizeBytes, storageKey: input.storageKey, url: input.url.trim() }
}

async function adminRecipients() {
  return db.user.findMany({ where: { role: { in: ["SUPER_ADMIN", "SUB_ADMIN"] }, isBanned: false }, select: { id: true, email: true, name: true } })
}

export async function notifyCustomServiceAdmins(input: { title: string; body: string; actionUrl: string; emailSubject: string; emailMessage: string }) {
  const admins = await adminRecipients()
  await Promise.all(admins.map(async (admin) => {
    await createNotification({ userId: admin.id, type: "SYSTEM", title: input.title, body: input.body, actionUrl: input.actionUrl, metadata: { source: "custom-service-portal" } }).catch(() => null)
    await enqueueEmail({ emailType: "CUSTOM_SERVICE_REQUEST_RECEIVED", recipient: admin.email, subject: input.emailSubject, templateName: "communication", payload: { name: admin.name, title: input.emailSubject, message: input.emailMessage, ctaLabel: "Open request", ctaUrl: input.actionUrl }, userId: admin.id }).catch(() => null)
  }))
}

export async function notifyCustomServiceClient(input: { userId: string; email: string; name: string; title: string; body: string; actionUrl: string; emailType: "CUSTOM_SERVICE_REQUEST_REPLY" | "CUSTOM_SERVICE_REQUEST_STATUS_UPDATED" }) {
  await createNotification({ userId: input.userId, type: "SYSTEM", title: input.title, body: input.body, actionUrl: input.actionUrl, metadata: { source: "custom-service-portal" } }).catch(() => null)
  await enqueueEmail({ emailType: input.emailType, recipient: input.email, subject: input.title, templateName: "communication", payload: { name: input.name, title: input.title, message: input.body, ctaLabel: "Open discussion", ctaUrl: input.actionUrl }, userId: input.userId }).catch(() => null)
}

export async function emitCustomServiceMessage(requestId: string, payload: Record<string, unknown>) {
  const pusher = await getPusherServer()
  await pusher.trigger(`private-service-request-${requestId}`, "custom-service.message", payload).catch(() => null)
}

export async function emitCustomServiceRequest(requestId: string, payload: Record<string, unknown>) {
  const pusher = await getPusherServer()
  await pusher.trigger(`private-service-request-${requestId}`, "custom-service.request", payload).catch(() => null)
}

export function safeRequestSnapshot(request: { id: string; requestNumber: string; status: CustomServiceRequestStatus; projectTitle: string; lastActivityAt: Date }) {
  return { id: request.id, requestNumber: request.requestNumber, status: request.status, projectTitle: request.projectTitle, lastActivityAt: request.lastActivityAt }
}
