import { revalidatePath, revalidateTag } from "next/cache"

// In Next.js 16, revalidateTag(tag, type) requires 2 arguments
// Use empty string "" as the second argument (equivalent to "page")
const T = "" as const

/**
 * Revalidate all caches related to products.
 * Call after any product create/update/delete/status change.
 */
export function revalidateProducts(slug?: string) {
  revalidateTag("products", T)
  revalidateTag("featured-products", T)
  revalidateTag("home-products", T)
  revalidateTag("trending", T)
  revalidateTag("pricing", T)
  revalidateTag("agents", T)
  revalidateTag("marketplace-data", T)
  revalidatePath("/", "layout")
  revalidatePath("/marketplace", "layout")
  revalidatePath("/ai-agents", "layout")
  revalidatePath("/pricing", "layout")
  if (slug) revalidatePath(`/marketplace/${slug}`, "page")
}

/**
 * Revalidate campaign-related caches.
 * Call after any campaign create/update/delete.
 */
export function revalidateCampaigns() {
  revalidateTag("campaigns", T)
  revalidateTag("active-campaign", T)
  revalidateTag("marketplace-data", T)
  revalidatePath("/", "layout")
  revalidatePath("/marketplace", "layout")
}

/**
 * Revalidate platform stats cache.
 * Call after user/subscription changes.
 */
export function revalidatePlatformStats() {
  revalidateTag("platform-stats", T)
  revalidatePath("/", "layout")
}

/**
 * Revalidate blog/content caches.
 */
export function revalidateBlog(slug?: string) {
  revalidateTag("blog", T)
  revalidatePath("/blog", "layout")
  if (slug) revalidatePath(`/blog/${slug}`, "page")
}

/**
 * Revalidate agent-specific caches.
 */
export function revalidateAgents() {
  revalidateTag("agents", T)
  revalidateTag("agent-data", T)
  revalidateTag("products", T)
  revalidatePath("/ai-agents", "layout")
  revalidatePath("/marketplace", "layout")
  revalidatePath("/", "layout")
}

/**
 * Revalidate a specific product slug page.
 */
export function revalidateProductSlug(slug: string) {
  revalidatePath(`/marketplace/${slug}`, "page")
  revalidatePath("/marketplace", "layout")
}

/**
 * Nuclear option — revalidate everything.
 */
export function revalidateAll() {
  revalidatePath("/", "layout")
}
