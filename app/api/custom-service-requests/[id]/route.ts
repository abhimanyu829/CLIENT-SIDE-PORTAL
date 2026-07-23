import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { assertCustomServiceRequestAccess, CUSTOM_SERVICE_STATUSES, emitCustomServiceRequest, notifyCustomServiceClient } from "@/lib/custom-service-portal"

const statusSchema = z.object({ status: z.enum(["NEW", "UNDER_REVIEW", "DISCUSSION", "PROPOSAL_SENT", "APPROVED", "IN_DEVELOPMENT", "COMPLETED", "CLOSED"]) })

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  try {
    const { id } = await params; const access = await assertCustomServiceRequestAccess(id, session.user.id)
    const detail = await db.customServiceRequest.findUnique({ where: { id }, include: { attachments: true, client: { select: { id: true, name: true, email: true } }, messages: { where: access.isAdmin ? undefined : { isInternal: false }, orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true, role: true } }, attachments: true } } } })
    return NextResponse.json({ success: true, data: { request: detail, isAdmin: access.isAdmin } })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error && error.message === "FORBIDDEN" ? "Forbidden" : "Request not found" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 404 }) }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  try {
    const { id } = await params; const access = await assertCustomServiceRequestAccess(id, session.user.id)
    if (!access.isAdmin) return NextResponse.json({ success: false, error: "Only administrators can update request status" }, { status: 403 })
    const parsed = statusSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid request status" }, { status: 422 })
    const updated = await db.customServiceRequest.update({ where: { id }, data: { status: parsed.data.status, lastActivityAt: new Date() }, include: { client: { select: { id: true, email: true, name: true } } } })
    const actionUrl = `/dashboard/service-requests/${updated.id}`
    await notifyCustomServiceClient({ userId: updated.client.id, email: updated.client.email, name: updated.client.name, title: `Service request status: ${updated.status.replaceAll("_", " ")}`, body: `Your request ${updated.requestNumber} is now ${updated.status.replaceAll("_", " ").toLowerCase()}.`, actionUrl, emailType: "CUSTOM_SERVICE_REQUEST_STATUS_UPDATED" })
    await emitCustomServiceRequest(id, { type: "status", status: updated.status })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error && error.message === "FORBIDDEN" ? "Forbidden" : "Unable to update status" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 }) }
}
