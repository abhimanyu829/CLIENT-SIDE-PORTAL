import nodemailer from "nodemailer"
import { render } from "@react-email/render"
import ManualPaymentReviewAdminEmail from "@/emails/ManualPaymentReviewAdminEmail"
import { sendEmail } from "@/lib/resend"

export interface ManualPaymentReviewEmailParams {
  adminName: string
  adminEmail: string
  orderNumber: string
  orderId: string
  userEmail: string
  productSummary: string
  claimedUtr: string
  claimedAmount: string
  expectedAmount: string
  currency: string
  reviewUrl: string
}

function buildSmtpTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  if (!host || !user || !password) return null

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass: password },
  })
}

export async function sendManualPaymentReviewEmail(params: ManualPaymentReviewEmailParams) {
  const smtp = buildSmtpTransport()
  const html = render(
    ManualPaymentReviewAdminEmail({
      adminName: params.adminName,
      adminEmail: params.adminEmail,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      userEmail: params.userEmail,
      productSummary: params.productSummary,
      claimedUtr: params.claimedUtr,
      claimedAmount: params.claimedAmount,
      expectedAmount: params.expectedAmount,
      currency: params.currency,
      reviewUrl: params.reviewUrl,
    })
  )

  if (smtp) {
    const from = process.env.SMTP_FROM ?? process.env.EMAIL_FROM ?? "NexusAI <no-reply@nexusai.com>"
    await smtp.sendMail({
      from,
      to: params.adminEmail,
      subject: `Manual payment review required: ${params.orderNumber}`,
      html,
    })
    return { provider: "smtp" as const }
  }

  return sendEmail({
    to: params.adminEmail,
    subject: `Manual payment review required: ${params.orderNumber}`,
    react: ManualPaymentReviewAdminEmail({
      adminName: params.adminName,
      adminEmail: params.adminEmail,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      userEmail: params.userEmail,
      productSummary: params.productSummary,
      claimedUtr: params.claimedUtr,
      claimedAmount: params.claimedAmount,
      expectedAmount: params.expectedAmount,
      currency: params.currency,
      reviewUrl: params.reviewUrl,
    }),
    tags: [{ name: "type", value: "manual-payment-review" }],
  })
}
