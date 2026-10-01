/**
 * Strips internal/sensitive fields from a product object before sending to the client.
 * Ensures credentials, internal notes, and vendor payout details never leak.
 */

const SENSITIVE_PRODUCT_FIELDS = [
  // Product model fields that are never public: delivery secrets (encrypted,
  // still never sent to a browser), owner-only access links and notes, the
  // reserving customer, and internal editor bookkeeping.
  "deliveryConfig",
  "productAccessUrl",
  "productLoginUrl",
  "productDashboardUrl",
  "productAccessNotes",
  "assignedUserId",
  "assignedEmail",
  "reservedUntil",
  "lockedBy",
  "lockedAt",
  "createdBy",
  "lastEditedBy",
  // Generic credential-like names (defense in depth).
  "vendorNotes",
  "internalNotes",
  "apiKey",
  "apiSecret",
  "webhookSecret",
  "stripeAccountId",
  "payoutSchedule",
  "payoutBalance",
  "commissionRate",
  "vendorPayoutEmail",
  "rawConfig",
  "deploymentConfig",
  "envVars",
] as const

export function sanitizeProductForPublic(product: Record<string, any>): Record<string, any> {
  const sanitized = { ...product }
  for (const field of SENSITIVE_PRODUCT_FIELDS) {
    delete sanitized[field]
  }
  // Also strip nested credential-like fields from tiers
  if (Array.isArray(sanitized.tiers)) {
    sanitized.tiers = sanitized.tiers.map((tier: Record<string, any>) => {
      const clean = { ...tier }
      delete clean.apiKey
      delete clean.apiSecret
      delete clean.webhookSecret
      delete clean.internalNotes
      delete clean.deploymentConfig
      delete clean.envVars
      return clean
    })
  }
  return sanitized
}

export function sanitizeProductsForPublic(products: Record<string, any>[]): Record<string, any>[] {
  return products.map(sanitizeProductForPublic)
}