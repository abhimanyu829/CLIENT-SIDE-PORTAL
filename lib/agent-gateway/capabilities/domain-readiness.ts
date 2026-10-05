/**
 * lib/agent-gateway/capabilities/domain-readiness.ts
 *
 * Phase 13 — the capability map of the business domains, as code.
 *
 * Every operation an agent might want in the five Phase 13 domains is
 * listed with an honest readiness:
 *
 *   READY      an executable, agent-available capability exists (id given);
 *   NOT_READY  deliberately not executable, with the blocker that has to be
 *              resolved first. A NOT_READY operation may still be DESCRIBED
 *              in the manifest (coupons.create, products.createDraft,
 *              products.updatePricing) but has no adapter, so it is never a
 *              tool (Phase 12 executable-only surface).
 *
 * p13-domain-capabilities.test.ts proves the map and the live registries
 * agree in both directions: nothing READY is missing an adapter, nothing
 * NOT_READY can execute, and no executable capability is missing from the
 * map. Documented in docs/agent-gateway/phase-13/07-capability-map.md.
 */

export type BusinessDomain = "PRODUCTS" | "MARKETING" | "SUBSCRIPTIONS" | "SUPPORT" | "ANALYTICS"

export type DomainOperation =
  | { domain: BusinessDomain; operation: string; readiness: "READY"; capabilityId: string }
  | { domain: BusinessDomain; operation: string; readiness: "NOT_READY"; capabilityId?: string; blocker: string }

export const DOMAIN_CAPABILITY_MAP: readonly DomainOperation[] = [
  // Products
  { domain: "PRODUCTS", operation: "browse the published catalogue", readiness: "READY", capabilityId: "products.list" },
  { domain: "PRODUCTS", operation: "read one published product", readiness: "READY", capabilityId: "products.get" },
  { domain: "PRODUCTS", operation: "list my vendor products", readiness: "READY", capabilityId: "products.listMine" },
  { domain: "PRODUCTS", operation: "create a product draft", readiness: "READY", capabilityId: "products.createDraft" },
  { domain: "PRODUCTS", operation: "update a product draft", readiness: "READY", capabilityId: "products.update" },
  { domain: "PRODUCTS", operation: "archive a product", readiness: "READY", capabilityId: "products.archive" },
  {
    domain: "PRODUCTS",
    operation: "change pricing",
    readiness: "NOT_READY",
    capabilityId: "products.updatePricing",
    blocker: "HIGH_RISK_MUTATION with direct financial impact; INTERNAL_ONLY by Phase 3 decision.",
  },
  { domain: "PRODUCTS", operation: "publish a product (status change to AVAILABLE)", readiness: "NOT_READY", blocker: "Admin moderation workflow (versioning, locking, review) has no agent-safe entry point." },

  // Marketing
  { domain: "MARKETING", operation: "read the active campaign", readiness: "READY", capabilityId: "campaigns.getActive" },
  {
    domain: "MARKETING",
    operation: "create a coupon",
    readiness: "NOT_READY",
    capabilityId: "coupons.create",
    blocker: "The existing createCoupon action requires a Clerk admin session and no RBAC permission covers coupons (Phase 3 gap).",
  },
  { domain: "MARKETING", operation: "create / edit / activate a campaign", readiness: "NOT_READY", blocker: "Admin-only route (app/api/admin/campaigns); discounts affect revenue for every customer." },
  { domain: "MARKETING", operation: "send e-mail campaigns", readiness: "NOT_READY", blocker: "Bulk outbound messaging to customers; no per-recipient consent check on an agent path." },

  // Subscriptions
  { domain: "SUBSCRIPTIONS", operation: "read one of my subscriptions", readiness: "READY", capabilityId: "subscriptions.get" },
  { domain: "SUBSCRIPTIONS", operation: "list my subscriptions", readiness: "READY", capabilityId: "subscriptions.list" },
  {
    domain: "SUBSCRIPTIONS",
    operation: "pause / resume / cancel / upgrade / downgrade",
    readiness: "NOT_READY",
    blocker: "The existing routes call the payment gateways (billing state, proration, refunds); financial operations need a durable gateway idempotency key first (Phase 0 BUG-BASELINE #14).",
  },

  // Support
  { domain: "SUPPORT", operation: "list my tickets", readiness: "READY", capabilityId: "tickets.list" },
  { domain: "SUPPORT", operation: "read one of my tickets", readiness: "READY", capabilityId: "tickets.get" },
  { domain: "SUPPORT", operation: "open a ticket", readiness: "READY", capabilityId: "tickets.create" },
  { domain: "SUPPORT", operation: "close my ticket", readiness: "READY", capabilityId: "tickets.close" },
  {
    domain: "SUPPORT",
    operation: "reply to a ticket",
    readiness: "NOT_READY",
    blocker: "A reply cannot be retracted (no delete path, so IRREVERSIBLE) and the existing route also pushes it to an external real-time service (Pusher) from the request; that outbound call needs the Phase 12 outbound guard and a reviewed notification path first.",
  },
  { domain: "SUPPORT", operation: "assign / prioritise / resolve (staff)", readiness: "NOT_READY", blocker: "Staff-only transitions; agents act for customers, never as support staff." },

  // Analytics
  { domain: "ANALYTICS", operation: "my account summary", readiness: "READY", capabilityId: "analytics.summary" },
  { domain: "ANALYTICS", operation: "my product performance", readiness: "READY", capabilityId: "analytics.productPerformance" },
  { domain: "ANALYTICS", operation: "platform-wide analytics / revenue", readiness: "NOT_READY", blocker: "Admin-only (app/api/analytics, admin dashboards); cross-tenant aggregate data is never agent-available." },
]
