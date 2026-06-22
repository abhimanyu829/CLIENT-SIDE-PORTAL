import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { logger } from "@/lib/logger"
import { createNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/resend"
import { resolveSuperAdminEmail } from "@/lib/email/service"
import { auditLog } from "@/lib/audit"
import { revokeServiceOrderAccess } from "@/lib/services/service-commerce"
import * as React from "react"
import CommunicationEmail from "@/emails/CommunicationEmail"

const actionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "CLOSE"]),
  adminNotes: z.string().max(5000).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireSuperAdmin()
    const { id } = await params
    const body = await req.json()
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid action", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const request = await db.serviceRequest.findUnique({
      where: { id },
      include: { servicePage: { select: { id: true, title: true, slug: true } } },
    })

    if (!request) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service request not found" } }, { status: 404 })
    }

    if (request.status !== "OPEN") {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: `Request already ${request.status.toLowerCase()}` } },
        { status: 409 }
      )
    }

    const nextStatus = parsed.data.action === "APPROVE"
      ? "APPROVED"
      : parsed.data.action === "REJECT"
        ? "REJECTED"
        : "CLOSED"

    const updated = await db.serviceRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        adminNotes: parsed.data.adminNotes?.trim() || null,
        reviewedBy: admin.userId,
        reviewedAt: new Date(),
        resolvedAt: nextStatus === "APPROVED" ? new Date() : undefined,
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const serviceTitle = request.servicePage?.title ?? "Service request"
    const userBody =
      parsed.data.action === "APPROVE"
        ? `Your ${request.type.toLowerCase()} request for ${serviceTitle} has been approved.`
        : parsed.data.action === "REJECT"
          ? `Your ${request.type.toLowerCase()} request for ${serviceTitle} has been rejected.`
          : `Your ${request.type.toLowerCase()} request for ${serviceTitle} has been closed.`

    await sendEmail({
      to: request.email,
      subject: `NexusAI ${request.type.toLowerCase()} request ${nextStatus.toLowerCase()}`,
      react: React.createElement(CommunicationEmail, {
        preview: userBody,
        title: `Request ${nextStatus.toLowerCase()}`,
        subtitle: serviceTitle,
        recipientName: request.name,
        body: userBody,
        ctaLabel: "View Service Center",
        ctaUrl: `${appUrl}/services/${request.servicePage?.slug ?? ""}`,
        details: [
          { label: "Request type", value: request.type },
          { label: "Order reference", value: request.orderRef || "N/A" },
          { label: "Admin notes", value: parsed.data.adminNotes?.trim() || "None" },
        ],
        footerNote: "This request was processed by NexusAI service operations.",
        locale: "en",
      }),
    })

    if (parsed.data.action === "APPROVE" && request.serviceOrderId) {
      await revokeServiceOrderAccess({
        orderId: request.serviceOrderId,
        actorId: admin.userId,
        reason: parsed.data.adminNotes?.trim() || `Approved ${request.type.toLowerCase()} request`,
        nextStatus: request.type === "REFUND" ? "REFUNDED" : "CANCELLED",
      })
    }

    const adminUser = await resolveSuperAdminEmail()
    if (adminUser?.id) {
      await createNotification({
        userId: adminUser.id,
        type: "SYSTEM",
        title: `Service request ${nextStatus.toLowerCase()}`,
        body: `${request.name}'s ${request.type.toLowerCase()} request was ${nextStatus.toLowerCase()}.`,
        actionUrl: `${appUrl}/admin/services/requests`,
        metadata: { requestId: request.id, status: nextStatus, adminNotes: parsed.data.adminNotes ?? null },
      }).catch(() => {})
    }

    await auditLog({
      userId: admin.userId,
      action: `SERVICE_REQUEST_${nextStatus}`,
      entity: "ServiceRequest",
      entityId: updated.id,
      after: {
        requestId: updated.id,
        status: nextStatus,
        type: updated.type,
        servicePageId: updated.servicePageId,
        reviewedBy: admin.userId,
        reviewedAt: updated.reviewedAt?.toISOString() ?? new Date().toISOString(),
      },
      req,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/services/requests/[id]")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Unable to update service request" } }, { status: 500 })
  }
}
