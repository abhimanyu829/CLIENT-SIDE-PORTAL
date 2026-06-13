import { createNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/resend"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import ManualPaymentReviewAdminEmail from "@/emails/ManualPaymentReviewAdminEmail"

export const MANUAL_PAYMENT_ADMIN_EMAIL = "luckypal5002@gmail.com"

type MoneyLike = string | number | null | undefined

export interface ManualPaymentOrderSnapshot {
  id: string
  orderNumber: string
  status: string
  grandTotal: MoneyLike
  currency: string
  user: { id: string; name: string | null; email: string }
  items: Array<{
    productId: string
    name: string
    quantity: number
    tierId: string | null
    tier: { id: string; name: string; interval: string } | null
  }>
}

export interface ManualPaymentVerificationSnapshot {
  id: string
  orderId: string
  userId: string
  utrNumber: string
  claimedAmount: MoneyLike
  screenshotUrl: string | null
  reviewAttemptCount: number
  mismatchReason: string | null
  verificationStatus: string
}

export interface ManualPaymentReviewInput {
  actualTransactionId: string
  actualAmount: MoneyLike
  adminUserId: string
  adminEmail?: string | null
  adminName?: string | null
  req?: Request | null
}

export interface ManualPaymentReviewResult {
  matched: boolean
  retryable: boolean
  expectedAmount: number
  claimedAmount: number
  actualAmount: number
  issues: string[]
}

export function normalizePaymentReference(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, "").toUpperCase()
}

export function formatMoney(value: MoneyLike) {
  return Number(Number(value ?? 0).toFixed(2))
}

export function compareManualPaymentReview(
  order: ManualPaymentOrderSnapshot,
  verification: ManualPaymentVerificationSnapshot,
  input: Pick<ManualPaymentReviewInput, "actualTransactionId" | "actualAmount">
): ManualPaymentReviewResult {
  const issues: string[] = []
  const expectedAmount = formatMoney(order.grandTotal)
  const claimedAmount = formatMoney(verification.claimedAmount)
  const actualAmount = formatMoney(input.actualAmount)
  const claimedReference = normalizePaymentReference(verification.utrNumber)
  const adminReference = normalizePaymentReference(input.actualTransactionId)
  const orderStatus = String(order.status).toUpperCase()

  if (!["PENDING", "AWAITING_VERIFICATION"].includes(orderStatus)) {
    issues.push(`Order status is ${order.status}; manual verification is no longer allowed.`)
  }

  if (order.items.length === 0) {
    issues.push("Order does not contain any product line items.")
  }

  for (const item of order.items) {
    if (!item.productId || !item.name?.trim()) {
      issues.push("Order product details are incomplete.")
      break
    }
    if (item.quantity <= 0) {
      issues.push("Order item quantity is invalid.")
      break
    }
    if (item.tier && !item.tier.name?.trim()) {
      issues.push("Order subscription plan details are incomplete.")
      break
    }
  }

  if (claimedAmount !== expectedAmount) {
    issues.push(`Submitted amount ${claimedAmount.toFixed(2)} does not match the order total ${expectedAmount.toFixed(2)}.`)
  }

  if (actualAmount !== expectedAmount) {
    issues.push(`Received amount ${actualAmount.toFixed(2)} does not match the order total ${expectedAmount.toFixed(2)}.`)
  }

  if (!adminReference) {
    issues.push("Actual transaction ID is required.")
  } else if (adminReference !== claimedReference) {
    issues.push("Actual transaction ID does not match the submitted UTR.")
  }

  return {
    matched: issues.length === 0,
    retryable: issues.length > 0 && verification.reviewAttemptCount < 1,
    expectedAmount,
    claimedAmount,
    actualAmount,
    issues,
  }
}

export async function resolveManualPaymentAdmin() {
  const primary = await db.user.findUnique({
    where: { email: MANUAL_PAYMENT_ADMIN_EMAIL },
    select: { id: true, email: true, name: true },
  })

  if (primary) {
    return primary
  }

  return db.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true, email: true, name: true },
  })
}

export async function notifyManualPaymentAdmin(input: {
  order: ManualPaymentOrderSnapshot
  verification: ManualPaymentVerificationSnapshot
}) {
  const admin = await resolveManualPaymentAdmin()
  const productSummary = input.order.items
    .map((item) => `${item.name}${item.tier?.name ? ` (${item.tier.name})` : ""}`)
    .join(", ")

  const metadata = {
    orderId: input.order.id,
    orderNumber: input.order.orderNumber,
    userId: input.order.user.id,
    userEmail: input.order.user.email,
    productSummary,
    claimedUtr: input.verification.utrNumber,
    claimedAmount: formatMoney(input.verification.claimedAmount),
    claimedAmountText: String(input.verification.claimedAmount ?? ""),
    orderTotal: formatMoney(input.order.grandTotal),
    currency: input.order.currency,
    reviewAttemptCount: input.verification.reviewAttemptCount,
  }

  if (admin?.id) {
    await createNotification({
      userId: admin.id,
      type: "PAYMENT",
      title: `Manual payment review: ${input.order.orderNumber}`,
      body: `${input.order.user.email} submitted UTR ${input.verification.utrNumber} for ${productSummary}.`,
      actionUrl: "/admin/payments/verifications",
      metadata,
    })
  }

  const adminEmail = admin?.email ?? MANUAL_PAYMENT_ADMIN_EMAIL
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `Manual payment review required: ${input.order.orderNumber}`,
      react: ManualPaymentReviewAdminEmail({
        adminName: admin?.name ?? "Admin",
        adminEmail,
        orderNumber: input.order.orderNumber,
        orderId: input.order.id,
        userEmail: input.order.user.email,
        productSummary,
        claimedUtr: input.verification.utrNumber,
        claimedAmount: String(input.verification.claimedAmount ?? ""),
        expectedAmount: String(formatMoney(input.order.grandTotal)),
        currency: input.order.currency,
        reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/admin/payments/verifications`,
      }),
      tags: [{ name: "type", value: "manual-payment-review" }],
    })
  }

  return { admin, metadata }
}

export async function logManualPaymentAudit(params: {
  action: string
  orderId: string
  orderNumber: string
  userId: string
  verificationId: string
  adminUserId?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  metadata?: Record<string, unknown>
  req?: Request | null
}) {
  await auditLog({
    userId: params.adminUserId ?? params.userId,
    action: params.action,
    entity: "PaymentVerification",
    entityId: params.verificationId,
    before: params.before,
    after: params.after,
    metadata: {
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      userId: params.userId,
      ...params.metadata,
    },
    req: params.req as any,
  })
}
