import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { assertCustomServiceRequestAccess, emitCustomServiceMessage, normalizeAttachment, notifyCustomServiceAdmins, notifyCustomServiceClient } from "@/lib/custom-service-portal"

const attachmentSchema = z.object({ fileName: z.string().max(200), mimeType: z.string().max(150), sizeBytes: z.number().int(), storageKey: z.string().max(500), url: z.string().min(1).max(1500) })
const messageSchema = z.object({ body: z.string().trim().max(8000).default(""), isInternal: z.boolean().optional().default(false), attachments: z.array(attachmentSchema).max(8).default([]) }).refine((value) => value.body.length > 0 || value.attachments.length > 0, { message: "Write a message or attach a file" })

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  try { const { id } = await params; const access = await assertCustomServiceRequestAccess(id, session.user.id); const messages = await db.customServiceDiscussionMessage.findMany({ where: { requestId: id, ...(access.isAdmin ? {} : { isInternal: false }) }, orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true, role: true } }, attachments: true } }); return NextResponse.json({ success: true, data: messages, isAdmin: access.isAdmin }) } catch (error) { return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  try {
    const { id } = await params; const access = await assertCustomServiceRequestAccess(id, session.user.id); const parsed = messageSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid message" }, { status: 422 })
    if (!access.isAdmin && parsed.data.isInternal) return NextResponse.json({ success: false, error: "Clients cannot create internal notes" }, { status: 403 })
    const attachments = parsed.data.attachments.map((attachment) => normalizeAttachment(attachment, session.user.id))
    const message = await db.$transaction(async (tx) => {
      const created = await tx.customServiceDiscussionMessage.create({ data: { requestId: id, senderId: session.user.id, senderType: access.isAdmin ? "ADMIN" : "CLIENT", body: parsed.data.body, isInternal: access.isAdmin && parsed.data.isInternal, attachments: { create: attachments.map((a) => ({ ...a, requestId: id })) } }, include: { sender: { select: { id: true, name: true, role: true } }, attachments: true } })
      await tx.customServiceRequest.update({ where: { id }, data: { lastActivityAt: new Date(), status: access.isAdmin ? "DISCUSSION" : undefined } })
      return created
    })
    const serviceRequest = await db.customServiceRequest.findUnique({ where: { id }, include: { client: { select: { id: true, email: true, name: true } } } })
    if (serviceRequest && !message.isInternal) {
      if (access.isAdmin) await notifyCustomServiceClient({ userId: serviceRequest.client.id, email: serviceRequest.client.email, name: serviceRequest.client.name, title: `NexusAI replied to ${serviceRequest.requestNumber}`, body: message.body || "NexusAI shared an attachment in your discussion.", actionUrl: `/dashboard/service-requests/${id}`, emailType: "CUSTOM_SERVICE_REQUEST_REPLY" })
      else await notifyCustomServiceAdmins({ title: `Client reply: ${serviceRequest.projectTitle}`, body: `${serviceRequest.fullName} replied to ${serviceRequest.requestNumber}.`, actionUrl: `/admin/service-requests/${id}`, emailSubject: `Client reply on ${serviceRequest.requestNumber}`, emailMessage: message.body || "The client shared an attachment." })
    }
    await emitCustomServiceMessage(id, { type: "message", message })
    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to send message" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 }) }
}
