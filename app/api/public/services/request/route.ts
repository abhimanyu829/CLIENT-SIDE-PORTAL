import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { sendEmail } from "@/lib/resend"
import { createNotification } from "@/lib/notifications"
import { resolveSuperAdminEmail } from "@/lib/email/service"
import ServiceRequestAdminEmail from "@/emails/ServiceRequestAdminEmail"
import ServiceRequestUserEmail from "@/emails/ServiceRequestUserEmail"
import * as React from "react"

const requestSchema = z.object({
  servicePageId: z.string().optional(),
  serviceOrderId: z.string().optional(),
  requestType: z.enum(["CANCELLATION", "REFUND"]),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  orderRef: z.string().max(120).optional(),
  reason: z.string().min(10).max(5000),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const { servicePageId, serviceOrderId, requestType, name, email, orderRef, reason } = parsed.data

    let serviceTitle: string | null = null
    let linkedOrder: {
      id: string
      orderNumber: string
      paidAt: Date | null
      user: { email: string; name: string }
      servicePage: { id: string; title: string; slug: string }
    } | null = null
    if (servicePageId) {
      const service = await db.servicePage.findUnique({
        where: { id: servicePageId },
        select: { id: true, title: true, isActive: true },
      })
      if (!service) {
        return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service page not found" } }, { status: 404 })
      }
      serviceTitle = service.title
    }

    if (serviceOrderId) {
      const order = await db.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        select: {
          id: true,
          orderNumber: true,
          paidAt: true,
          status: true,
          user: { select: { email: true, name: true } },
          servicePage: { select: { id: true, title: true, slug: true } },
        },
      })
      if (!order) {
        return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service order not found" } }, { status: 404 })
      }
      if (order.user.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Order email does not match" } }, { status: 403 })
      }
      if (order.status !== "ACTIVE" && order.status !== "PAID") {
        return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Service order is not eligible for cancellation or refund" } }, { status: 409 })
      }

      const windowStartsAt = order.paidAt ?? new Date()
      const refundEligibleUntil = new Date(windowStartsAt.getTime() + 24 * 60 * 60 * 1000)
      if (refundEligibleUntil < new Date()) {
        return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Cancellation window has expired" } }, { status: 409 })
      }

      linkedOrder = order
      serviceTitle = order.servicePage.title
    }

    const request = await db.serviceRequest.create({
      data: {
        servicePageId: servicePageId ?? null,
        serviceOrderId: linkedOrder?.id ?? serviceOrderId ?? null,
        type: requestType,
        name,
        email,
        orderRef: orderRef?.trim() || linkedOrder?.orderNumber || null,
        reason,
        status: "OPEN",
        refundEligibleUntil: linkedOrder ? new Date((linkedOrder.paidAt ?? new Date()).getTime() + 24 * 60 * 60 * 1000) : null,
        currency: "USD",
      },
    })

    const admin = await resolveSuperAdminEmail()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const adminUrl = `${appUrl}/admin/services/requests`

    if (admin?.id) {
      await createNotification({
        userId: admin.id,
        type: "SYSTEM",
        title: `New ${requestType.toLowerCase()} request`,
        body: `${name} submitted a ${requestType.toLowerCase()} request${serviceTitle ? ` for ${serviceTitle}` : ""}.`,
        actionUrl: adminUrl,
        metadata: {
          requestId: request.id,
          servicePageId,
          serviceTitle,
          requestType,
          orderRef: orderRef ?? null,
          serviceOrderId: linkedOrder?.id ?? serviceOrderId ?? null,
          email,
        },
      }).catch(() => {})
    }

    await sendEmail({
      to: admin?.email ?? "luckypal5002@gmail.com",
      subject: `New ${requestType.toLowerCase()} request ${serviceTitle ? `for ${serviceTitle}` : ""}`,
      react: React.createElement(ServiceRequestAdminEmail, {
        name,
        email,
        type: requestType,
        orderRef: orderRef ?? null,
        reason,
        servicePageTitle: serviceTitle,
        adminUrl,
      }),
      replyTo: email,
    })

    await sendEmail({
      to: email,
      subject: `Your ${requestType.toLowerCase()} request was received - NexusAI`,
      react: React.createElement(ServiceRequestUserEmail, {
        name,
        servicePageTitle: serviceTitle,
        type: requestType,
        orderRef: orderRef ?? null,
        adminUrl: `${appUrl}/admin/services`,
      }),
    })

    logger.info(
      { requestId: request.id, requestType, servicePageId, serviceTitle },
      "Service request created"
    )

    return NextResponse.json({ success: true, data: { id: request.id } }, { status: 201 })
  } catch (error) {
    logger.error({ error }, "POST /api/public/services/request")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
