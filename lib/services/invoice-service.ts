import * as React from "react"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { sendEmail } from "@/lib/resend"
import InvoiceEmail from "@/emails/InvoiceEmail"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"

function invoicePdfUrl(invoiceId: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/api/invoices/${invoiceId}/render`
}

export async function generateInvoiceArtifact(paymentId: string) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      user: true,
      invoice: true,
      subscription: { include: { tier: true, product: true } },
      order: { include: { items: true } },
    },
  })

  const invoice = payment.invoice ?? await db.invoice.create({
    data: {
      paymentId: payment.id,
      orderId: payment.orderId,
      subscriptionId: payment.subscriptionId,
      userId: payment.userId,
      number: `INV-${payment.id.slice(-8).toUpperCase()}`,
      totalAmount: payment.amount,
      taxAmount: payment.order?.taxTotal ?? 0,
      currency: payment.currency,
      status: payment.status === "SUCCESS" ? "PAID" : "PENDING",
      lineItems: payment.order?.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        taxAmount: String(item.taxAmount),
      })) ?? [],
    },
  })

  const pdfUrl = invoice.pdfUrl ?? invoicePdfUrl(invoice.id)
  const updated = await db.invoice.update({
    where: { id: invoice.id },
    data: { pdfUrl },
  })

  await emitEvent({
    type: EVENTS.PAYMENT_SUCCESS,
    timestamp: new Date().toISOString(),
    actorId: payment.userId,
    payload: { userId: payment.userId, invoiceId: updated.id, amount: Number(updated.totalAmount) },
  })

  return updated
}

export async function sendInvoiceEmail(paymentId: string) {
  const invoice = await generateInvoiceArtifact(paymentId)
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { user: true, subscription: { include: { tier: true, product: true } } },
  })

  await sendEmail({
    to: payment.user.email,
    subject: `Invoice ${invoice.number}`,
    react: React.createElement(InvoiceEmail, {
      name: payment.user.name,
      invoiceNumber: invoice.number,
      invoiceUrl: invoice.pdfUrl ?? invoicePdfUrl(invoice.id),
      amount: String(invoice.totalAmount),
      currency: invoice.currency,
      issuedAt: invoice.issuedAt.toDateString(),
      planName: payment.subscription
        ? `${payment.subscription.product.name} - ${payment.subscription.tier.name}`
        : "NexusAI order",
      periodStart: payment.subscription?.currentPeriodStart.toDateString() ?? invoice.issuedAt.toDateString(),
      periodEnd: payment.subscription?.currentPeriodEnd.toDateString() ?? invoice.issuedAt.toDateString(),
    }),
    tags: [{ name: "type", value: "invoice" }],
  })

  return invoice
}
