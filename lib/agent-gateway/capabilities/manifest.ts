/**
 * lib/agent-gateway/capabilities/manifest.ts
 *
 * Phase 3 core capability manifest — the code-first, version-controlled
 * source of truth for which capabilities exist and how they are shaped.
 *
 * Every capability below traces to a real entry in
 * docs/agent-gateway/phase-0/CAPABILITY-MATRIX.md /
 * docs/agent-gateway/phase-0/AI-EXPOSURE-CANDIDATES.md /
 * docs/agent-gateway/phase-0/RISK-MATRIX.md. None are invented. This file
 * intentionally registers a representative capability from each risk
 * tier (READ, LOW_RISK_WRITE, HIGH_RISK_MUTATION, CRITICAL) to prove the
 * registry can correctly describe — and, for CRITICAL, actively BLOCK —
 * every tier, not just the safe ones.
 *
 * NONE of these are wired to real execution in Phase 3. `executionReference`
 * is a controlled string identifier only, reserved for Phase 4's adapter
 * map. Registering a capability here does not make it callable by
 * anything — there is no MCP server, no HTTP discovery endpoint, and no
 * executor in this phase.
 */
import { z } from "zod"
import type { CapabilityDefinition } from "./types"
import type { CapabilityRegistry } from "./registry"

const productSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  type: z.string(),
})

// ── READ tier ────────────────────────────────────────────────────────────

const productsList: CapabilityDefinition = {
  id: "products.list",
  version: 1,
  domain: "products",
  name: "List products",
  description: "List published products visible to the caller. Read-only, no state mutation.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ status: z.string().optional(), category: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }).strict(),
  outputSchema: z.object({ items: z.array(productSummarySchema) }).strict(),
  errorContract: [{ code: "INVALID_INPUT", description: "Filter parameters failed validation." }],
  requiredIdentityContext: ["connectionId"],
  resource: { resourceType: "Product" },
  permission: { permission: "read:products" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry; returns the same result set for the same filters.", class: "IDEMPOTENT" },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only, nothing to roll back." },
  executionReference: { adapterKey: "products.listAdapter" },
  securityClassification: "PUBLIC (see DATA-SENSITIVITY-MATRIX.md: product catalog metadata).",
}

const productsGet: CapabilityDefinition = {
  id: "products.get",
  version: 1,
  domain: "products",
  name: "Get a single product",
  description: "Fetch one product by id or slug. Read-only.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ id: z.string().min(1).max(64) }).strict(),
  outputSchema: productSummarySchema,
  errorContract: [{ code: "RESOURCE_NOT_FOUND", description: "No product exists for the given id." }],
  requiredIdentityContext: ["connectionId"],
  resource: { resourceType: "Product", resourceLocator: "id" },
  permission: { permission: "read:products" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry.", class: "IDEMPOTENT" },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "products.getAdapter" },
  securityClassification: "PUBLIC (see DATA-SENSITIVITY-MATRIX.md: product catalog metadata).",
}

const subscriptionsGet: CapabilityDefinition = {
  id: "subscriptions.get",
  version: 1,
  domain: "subscriptions",
  name: "Get a subscription",
  description: "Fetch one subscription, scoped to the identity's owner (ownership-checked by the future Phase 4 adapter, same as the existing human-facing route). Read-only.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ subscriptionId: z.string().min(1).max(64) }).strict(),
  outputSchema: z.object({ id: z.string(), status: z.string(), planId: z.string() }).strict(),
  errorContract: [{ code: "RESOURCE_NOT_FOUND", description: "No subscription exists, or it is not owned by this identity's owner." }],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Subscription", resourceLocator: "subscriptionId" },
  permission: { permission: "read:billing" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry.", class: "IDEMPOTENT" },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "subscriptions.getAdapter" },
  securityClassification: "SENSITIVE (see DATA-SENSITIVITY-MATRIX.md: payment/billing details) — must remain strictly ownership-scoped by the Phase 4 adapter, never a bulk export.",
}

const ticketsList: CapabilityDefinition = {
  id: "tickets.list",
  version: 1,
  domain: "tickets",
  name: "List tickets",
  description: "List support tickets, scoped to the identity's owner. Read-only.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }).strict(),
  outputSchema: z.object({ items: z.array(z.object({ id: z.string(), subject: z.string(), status: z.string() })) }).strict(),
  errorContract: [{ code: "INVALID_INPUT", description: "Filter parameters failed validation." }],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Ticket" },
  permission: { permission: "read:tickets" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry.", class: "IDEMPOTENT" },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "tickets.listAdapter" },
  securityClassification: "INTERNAL/CONFIDENTIAL (see DATA-SENSITIVITY-MATRIX.md) — ownership-scoped only.",
}

// ── LOW_RISK_WRITE tier ─────────────────────────────────────────────────

const productsCreateDraft: CapabilityDefinition = {
  id: "products.createDraft",
  version: 1,
  domain: "products",
  name: "Create a product draft",
  description:
    "Creates a new product in DRAFT status. Reversible (delete the draft). Per Phase 0's AI-EXPOSURE-CANDIDATES.md, this is the recommended strongest pilot capability for the eventual first agent-invoked mutation.",
  status: "ACTIVE",
  operationType: "LOW_RISK_WRITE",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z
    .object({
      name: z.string().min(1).max(200),
      slug: z.string().min(1).max(200),
      tagline: z.string().min(1).max(300),
      description: z.string().min(1).max(5000),
      type: z.enum(["SAAS", "TEMPLATE", "AI_AGENT", "API_PRODUCT"]),
      category: z.string().max(100).optional(),
      tags: z.array(z.string().max(50)).max(20).optional(),
    })
    .strict(),
  outputSchema: productSummarySchema,
  errorContract: [
    { code: "INVALID_INPUT", description: "Required product fields are missing or malformed." },
    { code: "CONFLICT", description: "A product with the same slug already exists." },
  ],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Product" },
  permission: { permission: "write:products" },
  sideEffects: {
    effects: ["database write (Product, ProductVersion, AuditLog)", "cache invalidation"],
    emitsEvents: ["PRODUCT_CREATED"],
    triggersRevalidation: { tags: ["products"], paths: ["/admin/products"] },
  },
  idempotency: {
    requiresIdempotencyKey: true,
    idempotencyScope: "connectionId+slug",
    retrySafe: false,
    duplicateBehavior: "A naive retry creates a second draft with a conflicting slug (CONFLICT) — not naturally idempotent today.",
    class: "NON_IDEMPOTENT",
  },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "Delete the draft product (products.delete, not yet registered)." },
  executionReference: { adapterKey: "products.createDraftAdapter" },
  securityClassification: "PUBLIC once published; DRAFT rows are INTERNAL_ONLY until an admin changes status.",
}

const couponsCreate: CapabilityDefinition = {
  id: "coupons.create",
  version: 1,
  domain: "coupons",
  name: "Create a coupon",
  description: "Creates a new discount coupon. Reversible (delete).",
  status: "ACTIVE",
  operationType: "LOW_RISK_WRITE",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z
    .object({
      code: z.string().min(3).max(32),
      discountType: z.enum(["PERCENTAGE", "FIXED"]),
      discountValue: z.number().positive().max(100000),
      maxUses: z.number().int().positive().max(1_000_000).optional(),
      expiresAt: z.string().datetime().optional(),
    })
    .strict(),
  outputSchema: z.object({ id: z.string(), code: z.string(), isActive: z.boolean() }).strict(),
  errorContract: [
    { code: "INVALID_INPUT", description: "Coupon fields failed validation." },
    { code: "CONFLICT", description: "A coupon with the same code already exists." },
  ],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Coupon" },
  // No existing RBAC permission constant covers marketing/coupons today —
  // documented gap rather than inventing a new permission name.
  permission: { permission: null, note: "No existing lib/permissions.ts constant covers coupons; Phase 6 must define one rather than this registry inventing it." },
  sideEffects: { effects: ["database write (Coupon)"] },
  idempotency: {
    requiresIdempotencyKey: false,
    retrySafe: true,
    duplicateBehavior: "The existing createCoupon action already guards duplicate codes in-transaction (CONFLICT on retry).",
    class: "NON_IDEMPOTENT",
  },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "Delete the coupon (coupons.delete, not yet registered)." },
  executionReference: { adapterKey: "coupons.createAdapter" },
  securityClassification: "INTERNAL (marketing configuration, admin-authored today).",
}

// ── HIGH_RISK_MUTATION tier — described, but NOT freely agent-available ──

const productsUpdatePricing: CapabilityDefinition = {
  id: "products.updatePricing",
  version: 1,
  domain: "products",
  name: "Update product pricing tier",
  description:
    "Changes the price of an existing pricing tier. Direct financial impact on future purchases (Phase 0 RISK-MATRIX.md: HIGH_RISK_MUTATION). Exposure is deliberately INTERNAL_ONLY, not AGENT_AVAILABLE — no policy/approval engine (Phase 6/7) exists yet to gate this, so the contract is described for future readiness but is not (yet) a candidate for direct agent invocation.",
  status: "ACTIVE",
  operationType: "HIGH_RISK_MUTATION",
  exposure: "INTERNAL_ONLY",
  inputSchema: z
    .object({
      tierId: z.string().min(1).max(64),
      newPrice: z.number().nonnegative().max(10_000_000),
    })
    .strict(),
  outputSchema: z.object({ tierId: z.string(), price: z.number() }).strict(),
  errorContract: [
    { code: "INVALID_INPUT", description: "Price or tier id failed validation." },
    { code: "RESOURCE_NOT_FOUND", description: "The tier does not exist." },
    { code: "FORBIDDEN", description: "This capability requires human approval; no autonomous execution path exists." },
  ],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "ProductTier", resourceLocator: "tierId" },
  permission: { permission: "write:products" },
  sideEffects: {
    effects: ["database write (ProductTier, PricingHistory audit row)"],
    triggersRevalidation: { tags: ["pricing"], paths: ["/pricing"] },
  },
  idempotency: {
    requiresIdempotencyKey: true,
    idempotencyScope: "tierId",
    retrySafe: false,
    duplicateBehavior: "End-state idempotent (setting the same price twice is a no-op change), but a retry with a DIFFERENT intended price after a timeout could apply the wrong value — an idempotency key is required once Phase 4 wires real execution.",
    class: "NON_IDEMPOTENT",
  },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "Admin manually re-sets the previous price; PricingHistory provides an audit trail but no auto-revert." },
  executionReference: null,
  securityClassification: "CONFIDENTIAL (pricing is business-sensitive; see RISK-MATRIX.md HIGH_RISK_MUTATION rationale).",
}

// ── CRITICAL tier — described and ACTIVELY BLOCKED ──────────────────────

const refundsProcess: CapabilityDefinition = {
  id: "refunds.process",
  version: 1,
  domain: "refunds",
  name: "Process a refund (BLOCKED)",
  description:
    "Moves real money at an external payment processor. Per Phase 0's RISK-MATRIX.md and AI-EXPOSURE-CANDIDATES.md, this is an AI_BLOCKED, permanent architectural exclusion — not a phase-in-time restriction. The gateway-side refund call also has no idempotency key today (BUG-BASELINE #14), which independently disqualifies it from ever being an unsupervised action even if a future policy engine existed. Registered here ONLY to prove the registry can represent and actively reject a CRITICAL capability, never to make it callable.",
  status: "ACTIVE",
  operationType: "CRITICAL",
  exposure: "FORBIDDEN",
  inputSchema: null,
  outputSchema: null,
  errorContract: [{ code: "FORBIDDEN", description: "This capability is permanently excluded from any agent invocation." }],
  requiredIdentityContext: [],
  resource: { resourceType: "Payment" },
  permission: { permission: null, note: "Human-only, financial-settlement operation — never assigned an agent-facing permission." },
  sideEffects: { effects: ["external payment-gateway money movement"] },
  idempotency: {
    requiresIdempotencyKey: false,
    retrySafe: false,
    duplicateBehavior: "No gateway-side idempotency key exists on the real processRefund implementation — a retry could double-refund. This alone disqualifies autonomous or agent-triggered use.",
    class: "NON_IDEMPOTENT",
  },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "IRREVERSIBLE", mechanism: "None — a refund is terminal." },
  executionReference: null,
  securityClassification: "HIGHLY_SENSITIVE / CRITICAL — never exposable per Phase 0 architectural exclusion.",
}

export const CORE_CAPABILITY_MANIFEST: readonly CapabilityDefinition[] = [
  productsList,
  productsGet,
  subscriptionsGet,
  ticketsList,
  productsCreateDraft,
  couponsCreate,
  productsUpdatePricing,
  refundsProcess,
]

/**
 * Loads the core manifest into `registry`. Called once, at trusted
 * module-init time (see index.ts) — never from a request handler. If any
 * single definition is malformed, registration of the WHOLE manifest
 * fails (the registry never ends up in a "partially loaded" state) — this
 * is the fail-closed guarantee for manifest initialization.
 */
export function registerCoreCapabilities(registry: CapabilityRegistry): void {
  for (const def of CORE_CAPABILITY_MANIFEST) {
    registry.register(def)
  }
}
