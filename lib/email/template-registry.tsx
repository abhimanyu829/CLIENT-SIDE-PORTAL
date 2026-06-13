import * as React from "react"
import WelcomeEmail from "@/emails/WelcomeEmail"
import VerificationEmail from "@/emails/VerificationEmail"
import PasswordResetEmail from "@/emails/PasswordResetEmail"
import SubscriptionRenewalEmail from "@/emails/SubscriptionRenewalEmail"
import PaymentFailedEmail from "@/emails/PaymentFailedEmail"
import InvoiceEmail from "@/emails/InvoiceEmail"
import ProductDeliveryEmail from "@/emails/ProductDeliveryEmail"
import PreviewStartedEmail from "@/emails/PreviewStartedEmail"
import PreviewExpiredEmail from "@/emails/PreviewExpiredEmail"
import SubscriptionExpiryWarningEmail from "@/emails/SubscriptionExpiryWarningEmail"
import SubscriptionExpiredEmail from "@/emails/SubscriptionExpiredEmail"
import RefundConfirmationEmail from "@/emails/RefundConfirmationEmail"
import RefundRequestedAdminEmail from "@/emails/RefundRequestedAdminEmail"
import LoginAlertEmail from "@/emails/LoginAlertEmail"
import InvoiceReadyEmail from "@/emails/InvoiceReadyEmail"
import SuspiciousActivityEmail from "@/emails/SuspiciousActivityEmail"
import TicketReplyEmail from "@/emails/TicketReplyEmail"
import ManualPaymentReviewAdminEmail from "@/emails/ManualPaymentReviewAdminEmail"
import CommunicationEmail from "@/emails/CommunicationEmail"

export type EmailTemplatePayload = Record<string, unknown>

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

export function resolveEmailTemplate(templateName: string, payload: EmailTemplatePayload): React.ReactElement {
  const name = templateName.toLowerCase()

  if (name.includes("verification")) {
    return VerificationEmail({
      name: asString(payload.name, "there"),
      verificationUrl: asString(payload.verificationUrl, asString(payload.ctaUrl, "")),
      expiryMinutes: Number(payload.expiryMinutes ?? 15),
      supportEmail: asString(payload.supportEmail, "support@nexusai.com"),
      ipAddress: asString(payload.ipAddress, ""),
      deviceName: asString(payload.deviceName, ""),
    })
  }

  if (name.includes("welcome") || name.includes("registration")) {
    return WelcomeEmail({
      name: asString(payload.name, "there"),
      email: asString(payload.email, asString(payload.to, "")),
      dashboardUrl: asString(payload.dashboardUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard`),
    })
  }

  if (name.includes("password-reset") || name.includes("reset")) {
    return PasswordResetEmail({
      name: asString(payload.name, "there"),
      resetLink: asString(payload.resetLink, asString(payload.ctaUrl, "")),
      expiresInHours: Number(payload.expiresInHours ?? 1),
    })
  }

  if (name.includes("subscription-renewal")) {
    return SubscriptionRenewalEmail({
      name: asString(payload.name, "there"),
      planName: asString(payload.planName, "NexusAI"),
      renewalDate: asString(payload.renewalDate, new Date().toDateString()),
      amount: asString(payload.amount, ""),
      currency: asString(payload.currency, "USD"),
      manageUrl: asString(payload.manageUrl, asString(payload.ctaUrl, "")),
    })
  }

  if (name.includes("payment-failed")) {
    return PaymentFailedEmail({
      name: asString(payload.name, "there"),
      planName: asString(payload.planName, "NexusAI"),
      amount: asString(payload.amount, ""),
      failedAt: asString(payload.failedAt, new Date().toISOString()),
      retryDate: asString(payload.retryDate, new Date().toDateString()),
    })
  }

  if (name.includes("invoice-ready")) {
    return InvoiceReadyEmail({
      name: asString(payload.name, "there"),
      invoiceNumber: asString(payload.invoiceNumber, ""),
      productName: asString(payload.productName, "NexusAI"),
      amount: asString(payload.amount, ""),
      currency: asString(payload.currency, "USD"),
      issuedAt: asString(payload.issuedAt, new Date().toISOString()),
      invoiceUrl: asString(payload.invoiceUrl, ""),
      dashboardUrl: asString(payload.dashboardUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard`),
    })
  }

  if (name.includes("invoice")) {
    return InvoiceEmail({
      name: asString(payload.name, "there"),
      invoiceNumber: asString(payload.invoiceNumber, ""),
      invoiceUrl: asString(payload.invoiceUrl, ""),
      amount: asString(payload.amount, ""),
      currency: asString(payload.currency, "USD"),
      issuedAt: asString(payload.issuedAt, new Date().toISOString()),
      planName: asString(payload.planName, asString(payload.productName, "NexusAI")),
      periodStart: asString(payload.periodStart, ""),
      periodEnd: asString(payload.periodEnd, ""),
    })
  }

  if (name.includes("product-delivery") || name.includes("credentials-delivered")) {
    return ProductDeliveryEmail({
      name: asString(payload.name, "there"),
      productName: asString(payload.productName, "Your Product"),
      saasUrl: asString(payload.saasUrl, ""),
      username: asString(payload.username, ""),
      password: asString(payload.password, ""),
      apiKeys: Array.isArray(payload.apiKeys) ? (payload.apiKeys as string[]).join("\n") : asString(payload.apiKeys, ""),
      onboardingInstructions: asString(payload.onboardingInstructions, ""),
      accessDocUrl: asString(payload.accessDocUrl, ""),
      subscriptionDuration: asString(payload.subscriptionDuration, ""),
      renewalDate: asString(payload.renewalDate, ""),
      supportUrl: asString(payload.supportUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/tickets`),
    })
  }

  if (name.includes("preview-started")) {
    return PreviewStartedEmail({
      name: asString(payload.name, "there"),
      productName: asString(payload.productName, "Your Product"),
      previewUrl: asString(payload.previewUrl, ""),
      expiresAt: asString(payload.expiresAt, new Date().toISOString()),
      durationMinutes: Number(payload.durationMinutes ?? 10),
    })
  }

  if (name.includes("preview-expired")) {
    return PreviewExpiredEmail({
      name: asString(payload.name, "there"),
      productName: asString(payload.productName, "Your Product"),
      productSlug: asString(payload.productSlug, ""),
      appUrl: asString(payload.appUrl, process.env.NEXT_PUBLIC_APP_URL ?? "https://nexusai.com"),
    })
  }

  if (name.includes("expiry-warning")) {
    return SubscriptionExpiryWarningEmail({
      name: asString(payload.name, "there"),
      productName: asString(payload.productName, "Your Subscription"),
      daysUntilExpiry: Number(payload.daysUntilExpiry ?? 7),
      expiryDate: asString(payload.expiryDate, ""),
      renewUrl: asString(payload.renewUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/subscriptions`),
      amount: asString(payload.amount, ""),
      currency: asString(payload.currency, "USD"),
    })
  }

  if (name.includes("subscription-expired")) {
    return SubscriptionExpiredEmail({
      name: asString(payload.name, "there"),
      productName: asString(payload.productName, "Your Subscription"),
      expiredAt: asString(payload.expiredAt, new Date().toISOString()),
      renewUrl: asString(payload.renewUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/subscriptions`),
    })
  }

  if (name.includes("refund-confirmation")) {
    return RefundConfirmationEmail({
      name: asString(payload.name, "there"),
      productName: asString(payload.productName, "Your Product"),
      refundAmount: String(payload.refundAmount ?? "0"),
      currency: asString(payload.currency, "USD"),
      gateway: asString(payload.gateway, "Payment Gateway"),
      gatewayRefundId: asString(payload.gatewayRefundId, ""),
      estimatedDays: asString(payload.estimatedDays, "5-7"),
    })
  }

  if (name.includes("refund-requested-admin")) {
    return RefundRequestedAdminEmail({
      adminEmail: asString(payload.adminEmail, "admin@nexusai.com"),
      userName: asString(payload.userName, "User"),
      userEmail: asString(payload.userEmail, ""),
      productName: asString(payload.productName, "Unknown Product"),
      reason: asString(payload.reason, "No reason provided"),
      refundAmount: String(payload.refundAmount ?? "0"),
      currency: asString(payload.currency, "USD"),
      refundRequestId: asString(payload.refundRequestId, ""),
      adminUrl: asString(payload.adminUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/admin/payments`),
    })
  }

  if (name.includes("login-alert")) {
    return LoginAlertEmail({
      name: asString(payload.name, "there"),
      ipAddress: asString(payload.ipAddress, ""),
      userAgent: asString(payload.userAgent, ""),
      location: asString(payload.location, ""),
      loginAt: asString(payload.loginAt, new Date().toISOString()),
      securityUrl: asString(payload.securityUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/security`),
    })
  }

  if (name.includes("suspicious")) {
    return SuspiciousActivityEmail({
      name: asString(payload.name, "there"),
      activityType: asString(payload.activityType, "Suspicious activity detected"),
      details: asString(payload.details, ""),
      detectedAt: asString(payload.detectedAt, new Date().toISOString()),
      securityUrl: asString(payload.securityUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/security`),
    })
  }

  if (name.includes("ticket-reply")) {
    return TicketReplyEmail({
      name: asString(payload.name, "there"),
      ticketId: asString(payload.ticketId, ""),
      ticketTitle: asString(payload.ticketTitle, "Support update"),
      replySnippet: asString(payload.replySnippet, ""),
      replierName: asString(payload.replierName, "Support Team"),
      ticketUrl: asString(payload.ticketUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/tickets`),
    })
  }

  if (name.includes("manual-payment")) {
    return ManualPaymentReviewAdminEmail({
      adminName: asString(payload.adminName, "Admin"),
      adminEmail: asString(payload.adminEmail, "admin@nexusai.com"),
      orderNumber: asString(payload.orderNumber, ""),
      orderId: asString(payload.orderId, ""),
      userEmail: asString(payload.userEmail, ""),
      productSummary: asString(payload.productSummary, ""),
      claimedUtr: asString(payload.claimedUtr, ""),
      claimedAmount: asString(payload.claimedAmount, ""),
      expectedAmount: asString(payload.expectedAmount, ""),
      currency: asString(payload.currency, "USD"),
      reviewUrl: asString(payload.reviewUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/admin/payments/verifications`),
    })
  }

  return CommunicationEmail({
    preview: asString(payload.preview, asString(payload.subject, "NexusAI notification")),
    title: asString(payload.title, asString(payload.subject, "NexusAI notification")),
    subtitle: asString(payload.subtitle, ""),
    recipientName: asString(payload.name, "there"),
    body: asString(payload.body, "You have a new NexusAI notification."),
    ctaLabel: asString(payload.ctaLabel, ""),
    ctaUrl: asString(payload.ctaUrl, ""),
    details: Array.isArray(payload.details) ? (payload.details as any[]) : [],
    footerNote: asString(payload.footerNote, ""),
    locale: asString(payload.locale, "en"),
    unsubscribeUrl: asString(
      payload.unsubscribeUrl,
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/email/unsubscribe?token=${asString(payload.unsubscribeToken, "")}`
    ),
  })
}

export function renderEmailTemplate(templateName: string, payload: EmailTemplatePayload) {
  return resolveEmailTemplate(templateName, payload)
}
