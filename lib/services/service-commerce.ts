import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/resend"
import CommunicationEmail from "@/emails/CommunicationEmail"
import * as React from "react"

function parseDurationDays(label: string | null | undefined, type: string) {
  const text = (label ?? type ?? "").toLowerCase()
  if (text.includes("free trial")) return 7
  if (text.includes("1 month") || text.includes("monthly")) return 30
  if (text.includes("3 month")) return 90
  if (text.includes("6 month")) return 180
  if (text.includes("12 month") || text.includes("annual") || text.includes("year")) return 365
  return type === "ONE_TIME" ? null : 30
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export async function fulfillServiceOrder(params: {
  orderId: string
  actorId: string
  note?: string
}) {
  const order = await db.serviceOrder.findUnique({
    where: { id: params.orderId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      servicePage: { select: { id: true, slug: true, title: true } },
      servicePlan: { select: { id: true, name: true, type: true, billingLabel: true } },
      subscriptions: true,
      ownerships: true,
      entitlements: true,
    },
  })

  if (!order) {
    throw new Error("SERVICE_ORDER_NOT_FOUND")
  }

  if (order.status === "ACTIVE" && order.subscriptions.length > 0 && order.ownerships.length > 0 && order.entitlements.length > 0) {
    return order
  }

  if (order.status === "CANCELLED" || order.status === "FAILED") {
    throw new Error("SERVICE_ORDER_NOT_FULFILLABLE")
  }

  const now = new Date()
  const durationDays = parseDurationDays(order.servicePlan.billingLabel, order.servicePlan.type)
  const endsAt = durationDays ? addDays(now, durationDays) : null

  const fulfilled = await db.$transaction(async (tx) => {
    const subscription = await tx.serviceSubscription.create({
      data: {
        userId: order.userId,
        servicePageId: order.servicePageId,
        serviceOrderId: order.id,
        status: "ACTIVE",
        startsAt: now,
        endsAt,
        metadata: {
          orderNumber: order.orderNumber,
          planName: order.servicePlan.name,
          planType: order.servicePlan.type,
          billingLabel: order.servicePlan.billingLabel,
        },
      },
    })

    const ownership = await tx.serviceOwnership.create({
      data: {
        userId: order.userId,
        servicePageId: order.servicePageId,
        serviceOrderId: order.id,
        serviceSubscriptionId: subscription.id,
        status: "ACTIVE",
        assignedAt: now,
        expiresAt: endsAt,
        metadata: {
          orderNumber: order.orderNumber,
          serviceTitle: order.servicePage.title,
        },
      },
    })

    const entitlement = await tx.serviceEntitlement.create({
      data: {
        userId: order.userId,
        servicePageId: order.servicePageId,
        serviceOrderId: order.id,
        serviceSubscriptionId: subscription.id,
        serviceOwnershipId: ownership.id,
        status: "ACTIVE",
        accessType: order.servicePlan.type,
        startsAt: now,
        endsAt,
        credentialsSnapshot: {
          accessType: order.servicePlan.type,
          planName: order.servicePlan.name,
          serviceTitle: order.servicePage.title,
        },
        metadata: {
          orderNumber: order.orderNumber,
          actorId: params.actorId,
        },
      },
    })

    const updatedOrder = await tx.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: "ACTIVE",
        paidAt: order.paidAt ?? now,
        fulfilledAt: now,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: params.actorId,
        action: "SERVICE_ORDER_FULFILLED",
        entity: "ServiceOrder",
        entityId: order.id,
        afterJson: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          subscriptionId: subscription.id,
          ownershipId: ownership.id,
          entitlementId: entitlement.id,
          status: "ACTIVE",
        },
      },
    })

    return { updatedOrder, subscription, ownership, entitlement }
  })

  if (order.user?.id) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    await createNotification({
      userId: order.user.id,
      type: "SYSTEM",
      title: "Service order activated",
      body: `Your service order ${order.orderNumber} for ${order.servicePage.title} is now active.`,
      actionUrl: `${appUrl}/services/${order.servicePage.slug}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        servicePageId: order.servicePageId,
      },
    }).catch(() => {})

    await sendEmail({
      to: order.user.email,
      subject: `Your NexusAI service order ${order.orderNumber} is active`,
      react: React.createElement(CommunicationEmail, {
        preview: `Your service order ${order.orderNumber} is active`,
        title: "Service activated",
        subtitle: order.servicePage.title,
        recipientName: order.user.name ?? "there",
        body: `Your service order ${order.orderNumber} has been fulfilled and your subscription/ownership records are now active.`,
        ctaLabel: "Open service",
        ctaUrl: `${appUrl}/services/${order.servicePage.slug}`,
        details: [
          { label: "Order", value: order.orderNumber },
          { label: "Plan", value: order.servicePlan.name },
          { label: "Status", value: "ACTIVE" },
        ],
        footerNote: "This activation was generated by the NexusAI backend fulfillment engine.",
        locale: "en",
      }),
    }).catch(() => {})
  }

  return fulfilled
}

export async function revokeServiceOrderAccess(params: {
  orderId: string
  actorId: string
  reason: string
  nextStatus?: "CANCELLED" | "REFUNDED"
}) {
  const order = await db.serviceOrder.findUnique({
    where: { id: params.orderId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      servicePage: { select: { id: true, slug: true, title: true } },
      subscriptions: true,
      ownerships: true,
      entitlements: true,
    },
  })

  if (!order) {
    throw new Error("SERVICE_ORDER_NOT_FOUND")
  }

  const nextStatus = params.nextStatus ?? "CANCELLED"
  const alreadyTerminal = order.status === nextStatus || order.status === "FAILED" || order.status === "EXPIRED"
  if (alreadyTerminal) {
    return order
  }

  const now = new Date()
  const revoked = await db.$transaction(async (tx) => {
    await tx.serviceSubscription.updateMany({
      where: { serviceOrderId: order.id, status: "ACTIVE" },
      data: { status: nextStatus === "REFUNDED" ? "EXPIRED" : "CANCELLED", updatedAt: now },
    })

    await tx.serviceOwnership.updateMany({
      where: { serviceOrderId: order.id, status: "ACTIVE" },
      data: { status: nextStatus === "REFUNDED" ? "EXPIRED" : "REVOKED", updatedAt: now },
    })

    await tx.serviceEntitlement.updateMany({
      where: { serviceOrderId: order.id, status: "ACTIVE" },
      data: { status: "REVOKED", updatedAt: now },
    })

    const updatedOrder = await tx.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        updatedAt: now,
        metadata: {
          ...(order as any).metadata,
          revokedAt: now.toISOString(),
          revokedBy: params.actorId,
          revokeReason: params.reason,
          resolvedAs: nextStatus,
        },
      },
    })

    await tx.serviceRequest.updateMany({
      where: { serviceOrderId: order.id, status: "OPEN" },
      data: {
        status: "CLOSED",
        adminNotes: params.reason,
        reviewedBy: params.actorId,
        reviewedAt: now,
        resolvedAt: now,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: params.actorId,
        action: nextStatus === "REFUNDED" ? "SERVICE_ORDER_REFUNDED" : "SERVICE_ORDER_CANCELLED",
        entity: "ServiceOrder",
        entityId: order.id,
        afterJson: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          nextStatus,
          reason: params.reason,
        },
      },
    })

    return updatedOrder
  })

  if (order.user?.id) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    await createNotification({
      userId: order.user.id,
      type: "SYSTEM",
      title: `Service order ${nextStatus.toLowerCase()}`,
      body: `Your service order ${order.orderNumber} for ${order.servicePage.title} was ${nextStatus.toLowerCase()}.`,
      actionUrl: `${appUrl}/services/${order.servicePage.slug}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        nextStatus,
        reason: params.reason,
      },
    }).catch(() => {})

    await sendEmail({
      to: order.user.email,
      subject: `Your NexusAI service order ${nextStatus.toLowerCase()}`,
      react: React.createElement(CommunicationEmail, {
        preview: `Your service order ${order.orderNumber} was ${nextStatus.toLowerCase()}.`,
        title: `Service order ${nextStatus.toLowerCase()}`,
        subtitle: order.servicePage.title,
        recipientName: order.user.name ?? "there",
        body: `Your service order ${order.orderNumber} was ${nextStatus.toLowerCase()}. Reason: ${params.reason}`,
        ctaLabel: "Open service",
        ctaUrl: `${appUrl}/services/${order.servicePage.slug}`,
        details: [
          { label: "Order", value: order.orderNumber },
          { label: "Status", value: nextStatus },
          { label: "Reason", value: params.reason },
        ],
        footerNote: "This update was generated by the NexusAI service operations engine.",
        locale: "en",
      }),
    }).catch(() => {})
  }

  return revoked
}
