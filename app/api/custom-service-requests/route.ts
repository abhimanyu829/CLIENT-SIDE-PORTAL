import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCustomServicePortalSetting, makeCustomServiceRequestNumber, normalizeAttachment, notifyCustomServiceAdmins, notifyCustomServiceClient } from "@/lib/custom-service-portal"

const attachmentSchema = z.object({ fileName: z.string().max(200), mimeType: z.string().max(150), sizeBytes: z.number().int(), storageKey: z.string().max(500), url: z.string().min(1).max(1500) })
const requestSchema = z.object({
  fullName: z.string().trim().min(2).max(120), phone: z.string().trim().max(40).optional(), companyName: z.string().trim().max(120).optional(),
  serviceCategory: z.string().trim().min(2).max(100), projectTitle: z.string().trim().min(3).max(180), ideaDescription: z.string().trim().min(20).max(10000),
  problemStatement: z.string().trim().max(6000).optional(), requestedFeatures: z.string().trim().max(6000).optional(), targetUsers: z.string().trim().max(1000).optional(),
  expectedBudget: z.string().trim().max(100).optional(), expectedTimeline: z.string().trim().max(150).optional(), additionalNotes: z.string().trim().max(6000).optional(), attachments: z.array(attachmentSchema).max(8).default([]),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  const requests = await db.customServiceRequest.findMany({ where: { clientId: session.user.id }, orderBy: { lastActivityAt: "desc" }, select: { id: true, requestNumber: true, projectTitle: true, serviceCategory: true, status: true, lastActivityAt: true, createdAt: true } })
  return NextResponse.json({ success: true, data: requests })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Please sign in to submit a request" }, { status: 401 })
  const setting = await getCustomServicePortalSetting()
  if (!setting.isEnabled) return NextResponse.json({ success: false, error: "The service request portal is currently unavailable" }, { status: 503 })
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 })
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true } })
  if (!user) return NextResponse.json({ success: false, error: "Account not found" }, { status: 401 })
  try {
    const attachments = parsed.data.attachments.map((attachment) => normalizeAttachment(attachment, user.id))
    const serviceRequest = await db.customServiceRequest.create({
      data: {
        requestNumber: makeCustomServiceRequestNumber(), clientId: user.id, fullName: parsed.data.fullName, email: user.email,
        phone: parsed.data.phone || null, companyName: parsed.data.companyName || null, serviceCategory: parsed.data.serviceCategory, projectTitle: parsed.data.projectTitle,
        ideaDescription: parsed.data.ideaDescription, problemStatement: parsed.data.problemStatement || null, requestedFeatures: parsed.data.requestedFeatures || null,
        targetUsers: parsed.data.targetUsers || null, expectedBudget: parsed.data.expectedBudget || null, expectedTimeline: parsed.data.expectedTimeline || null,
        additionalNotes: parsed.data.additionalNotes || null, attachments: { create: attachments },
      },
      include: { attachments: true },
    })
    const actionUrl = `/admin/service-requests/${serviceRequest.id}`
    await notifyCustomServiceAdmins({ title: `New service request: ${serviceRequest.projectTitle}`, body: `${serviceRequest.fullName} submitted ${serviceRequest.requestNumber}.`, actionUrl, emailSubject: `New service request ${serviceRequest.requestNumber}`, emailMessage: `${serviceRequest.fullName} submitted “${serviceRequest.projectTitle}”.` })
    await notifyCustomServiceClient({ userId: user.id, email: user.email, name: user.name, title: "Your service request was received", body: `We received ${serviceRequest.requestNumber} and the NexusAI team will review it shortly.`, actionUrl: `/dashboard/service-requests/${serviceRequest.id}`, emailType: "CUSTOM_SERVICE_REQUEST_STATUS_UPDATED" })
    return NextResponse.json({ success: true, data: { id: serviceRequest.id, requestNumber: serviceRequest.requestNumber } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to submit request" }, { status: 422 })
  }
}
