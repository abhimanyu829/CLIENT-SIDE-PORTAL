import { Payment, Invoice, Subscription, ProductTier, Product } from "@prisma/client"

// Payment with its invoice
export type PaymentWithInvoice = Payment & {
  invoice: Invoice | null
}

// Payment with full context (for admin views)
export type PaymentWithDetails = Payment & {
  invoice: Invoice | null
  subscription:
    | (Subscription & {
        tier: ProductTier & { product: Pick<Product, "id" | "name" | "slug"> }
      })
    | null
}

// Invoice row for billing table
export type InvoiceRow = Pick<
  Invoice,
  | "id"
  | "number"
  | "status"
  | "totalAmount"
  | "currency"
  | "issuedAt"
  | "pdfUrl"
>

// Subscription with tier + product (for dashboard subscription card)
export type SubscriptionWithTier = Subscription & {
  tier: ProductTier & {
    product: Pick<Product, "id" | "name" | "slug" | "thumbnailUrl">
  }
}

// Payment status values
export const PAYMENT_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "DISPUTED",
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

// Invoice status values
export const INVOICE_STATUSES = ["DRAFT", "PENDING", "PAID", "OVERDUE", "VOID", "REFUNDED"] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

// Billing period values
export const BILLING_PERIODS = ["MONTHLY", "ANNUAL", "LIFETIME", "ONE_TIME"] as const
export type BillingPeriod = (typeof BILLING_PERIODS)[number]
