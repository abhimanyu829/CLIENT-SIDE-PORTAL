export type CapacityGroup = {
  title: string
  items: { label: string; value: string; enabled?: boolean }[]
}

export type IncludedService = {
  name: string
  description?: string
  enabled?: boolean
  sortOrder?: number
}

export type PaidAddon = {
  name: string
  description?: string
  price: string
  billingType: "ONE_TIME" | "SUBSCRIPTION" | "CONTACT"
  availability?: string
  activationTime?: string
  enabled?: boolean
  sortOrder?: number
}

export type UpgradePath = {
  currentPlan: string
  upgradeTo: string
  benefits: string[]
  ctaLabel?: string
  ctaHref?: string
  enabled?: boolean
}

export type ResourceLink = {
  title: string
  description?: string
  url: string
  enabled?: boolean
}

export type ProductServiceProfileView = {
  headline: string | null
  summary: string | null
  capacity: CapacityGroup[]
  freeServices: IncludedService[]
  paidAddons: PaidAddon[]
  upgradePaths: UpgradePath[]
  documentation: ResourceLink[]
  tutorials: ResourceLink[]
  supportBenefits: IncludedService[]
  hiddenFields: string[]
  isPublished: boolean
}

export const DEFAULT_PRODUCT_SERVICE_PROFILE: ProductServiceProfileView = {
  headline: "Service details and plan information",
  summary: "Review the resources, limits, included services, paid add-ons, and upgrade options available with this product.",
  capacity: [
    {
      title: "Team & Access",
      items: [
        { label: "Admin Accounts Included", value: "Configure in admin", enabled: true },
        { label: "Team Members Allowed", value: "Configure in admin", enabled: true },
        { label: "Workspace Limit", value: "Configure in admin", enabled: true },
      ],
    },
    {
      title: "Usage Capacity",
      items: [
        { label: "Maximum Concurrent Users", value: "Configure in admin", enabled: true },
        { label: "Maximum Storage", value: "Configure in admin", enabled: true },
        { label: "API Requests Per Month", value: "Configure in admin", enabled: true },
        { label: "AI Credits Included", value: "Configure in admin", enabled: true },
      ],
    },
    {
      title: "Support",
      items: [
        { label: "Email Support", value: "Included", enabled: true },
        { label: "Priority Support", value: "Upgrade available", enabled: true },
      ],
    },
  ],
  freeServices: [
    { name: "Free Installation", description: "Initial installation support", enabled: true, sortOrder: 0 },
    { name: "Documentation", description: "Product usage documentation", enabled: true, sortOrder: 1 },
  ],
  paidAddons: [
    {
      name: "Priority Support",
      description: "Faster response queue for active product owners",
      price: "Contact for pricing",
      billingType: "CONTACT",
      availability: "Available on request",
      activationTime: "After admin approval",
      enabled: true,
      sortOrder: 0,
    },
  ],
  upgradePaths: [],
  documentation: [],
  tutorials: [],
  supportBenefits: [],
  hiddenFields: [],
  isPublished: true,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function parseJsonField<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== "string" || !raw.trim()) return fallback
  const parsed = JSON.parse(raw)
  return parsed as T
}

export function normalizeProductServiceProfile(profile?: {
  headline?: string | null
  summary?: string | null
  capacity?: unknown
  freeServices?: unknown
  paidAddons?: unknown
  upgradePaths?: unknown
  documentation?: unknown
  tutorials?: unknown
  supportBenefits?: unknown
  hiddenFields?: string[]
  isPublished?: boolean
} | null): ProductServiceProfileView | null {
  if (!profile || profile.isPublished === false) return null

  return {
    headline: profile.headline ?? DEFAULT_PRODUCT_SERVICE_PROFILE.headline,
    summary: profile.summary ?? DEFAULT_PRODUCT_SERVICE_PROFILE.summary,
    capacity: Array.isArray(profile.capacity) ? profile.capacity as CapacityGroup[] : [],
    freeServices: Array.isArray(profile.freeServices) ? profile.freeServices as IncludedService[] : [],
    paidAddons: Array.isArray(profile.paidAddons) ? profile.paidAddons as PaidAddon[] : [],
    upgradePaths: Array.isArray(profile.upgradePaths) ? profile.upgradePaths as UpgradePath[] : [],
    documentation: Array.isArray(profile.documentation) ? profile.documentation as ResourceLink[] : [],
    tutorials: Array.isArray(profile.tutorials) ? profile.tutorials as ResourceLink[] : [],
    supportBenefits: Array.isArray(profile.supportBenefits) ? profile.supportBenefits as IncludedService[] : [],
    hiddenFields: Array.isArray(profile.hiddenFields) ? profile.hiddenFields : [],
    isPublished: profile.isPublished ?? true,
  }
}

export function toPrettyJson(value: unknown) {
  return JSON.stringify(value ?? [], null, 2)
}

export function normalizeCapacityForStorage(value: unknown) {
  if (Array.isArray(value)) return value
  if (isRecord(value)) return Object.entries(value).map(([title, items]) => ({ title, items }))
  return []
}
