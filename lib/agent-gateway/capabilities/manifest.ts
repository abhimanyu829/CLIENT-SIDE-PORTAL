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

/**
 * Phase 8 — READ capabilities may ALSO be submitted for asynchronous
 * execution through the Task Engine (lib/agent-gateway/tasks/). SYNC stays
 * their default mode: a direct tool call behaves exactly as before, and no
 * adapter or business service changes. Their adapters do not honour an
 * abort mid-query, so cooperative cancellation is not declared.
 */
const READ_ASYNC_SUPPORT: CapabilityDefinition["async"] = {
  executionMode: "SYNC",
  asyncSupported: true,
  queue: "agent-task",
  worker: "agent-task",
  pollingSupported: true,
}

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
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only, nothing to roll back." },
  executionReference: { adapterKey: "products.listAdapter" },
  securityClassification: "PUBLIC (see DATA-SENSITIVITY-MATRIX.md: product catalog metadata).",
  // Phase 12: product names and slugs are authored by vendors.
  contentTrust: "THIRD_PARTY_CONTENT",
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
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "products.getAdapter" },
  securityClassification: "PUBLIC (see DATA-SENSITIVITY-MATRIX.md: product catalog metadata). Phase 12: published (AVAILABLE) products only.",
  contentTrust: "THIRD_PARTY_CONTENT",
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
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "subscriptions.getAdapter" },
  securityClassification: "SENSITIVE (see DATA-SENSITIVITY-MATRIX.md: payment/billing details) — must remain strictly ownership-scoped by the Phase 4 adapter, never a bulk export.",
  // Phase 12: ids and status enums only; nothing a third party can write.
  contentTrust: "SYSTEM_GENERATED",
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
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "tickets.listAdapter" },
  securityClassification: "INTERNAL/CONFIDENTIAL (see DATA-SENSITIVITY-MATRIX.md) — ownership-scoped only.",
  // Phase 12: ticket subjects are written by customers.
  contentTrust: "THIRD_PARTY_CONTENT",
}

// ── Phase 13 — domain expansion (READ tier) ─────────────────────────────
// docs/agent-gateway/phase-13/07-capability-map.md maps every capability to
// the existing route / model it traces to, and lists what stays NOT_READY.

const ticketStatusFilter = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])
const productStatusFilter = z.enum(["DRAFT", "AVAILABLE", "RESERVED", "EXPIRED", "REPUBLISH_PENDING", "SCHEDULED", "ARCHIVED", "HIDDEN", "MAINTENANCE"])
const listLimit = z.number().int().min(1).max(50).optional()

const productsListMine: CapabilityDefinition = {
  id: "products.listMine",
  version: 1,
  domain: "products",
  name: "List my vendor products",
  description: "List the products of the caller's own vendor profile, any status. Read-only.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ status: productStatusFilter.optional(), limit: listLimit }).strict(),
  outputSchema: z.object({ items: z.array(productSummarySchema).max(50) }).strict(),
  errorContract: [{ code: "INVALID_INPUT", description: "Filter parameters failed validation." }],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Product" },
  permission: { permission: "read:products" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry.", class: "IDEMPOTENT" },
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "products.listMineAdapter" },
  securityClassification: "INTERNAL (the vendor's own catalogue, drafts included) — scoped by VendorProfile.userId = owner.",
  contentTrust: "THIRD_PARTY_CONTENT",
}

const campaignsGetActive: CapabilityDefinition = {
  id: "campaigns.getActive",
  version: 1,
  domain: "campaigns",
  name: "Get the active campaign",
  description: "Get the promotional campaign running now, if any, as shown on the storefront. Read-only.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({}).strict(),
  outputSchema: z
    .object({
      campaign: z
        .object({
          id: z.string(),
          name: z.string(),
          label: z.string().nullable(),
          type: z.string(),
          discountPercent: z.number(),
          bannerText: z.string().nullable(),
          startsAt: z.string(),
          endsAt: z.string(),
          applicableTierIds: z.array(z.string()).max(50),
          secondsRemaining: z.number().int().nonnegative(),
        })
        .strict()
        .nullable(),
    })
    .strict(),
  errorContract: [],
  requiredIdentityContext: ["connectionId"],
  resource: { resourceType: "Campaign" },
  permission: { permission: null, note: "Public storefront data (app/api/campaigns/active is unauthenticated); no RBAC constant covers marketing reads." },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry.", class: "IDEMPOTENT" },
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "campaigns.getActiveAdapter" },
  securityClassification: "PUBLIC (the same fields as the public active-campaign endpoint).",
  contentTrust: "THIRD_PARTY_CONTENT",
}

const subscriptionsList: CapabilityDefinition = {
  id: "subscriptions.list",
  version: 1,
  domain: "subscriptions",
  name: "List my subscriptions",
  description: "List the caller's own subscriptions. Read-only.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ status: z.enum(["ACTIVE", "CANCELLED", "PAST_DUE", "TRIALING", "PAUSED"]).optional(), limit: listLimit }).strict(),
  outputSchema: z
    .object({
      items: z
        .array(z.object({ id: z.string(), status: z.string(), planId: z.string(), productId: z.string(), currentPeriodEnd: z.string(), cancelAtPeriodEnd: z.boolean() }).strict())
        .max(50),
    })
    .strict(),
  errorContract: [{ code: "INVALID_INPUT", description: "Filter parameters failed validation." }],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Subscription" },
  permission: { permission: "read:billing" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry.", class: "IDEMPOTENT" },
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "subscriptions.listAdapter" },
  securityClassification: "SENSITIVE (billing) — owner-scoped; payment-gateway ids and metadata excluded.",
  contentTrust: "SYSTEM_GENERATED",
}

const ticketsGet: CapabilityDefinition = {
  id: "tickets.get",
  version: 1,
  domain: "tickets",
  name: "Get a ticket",
  description: "Get one of the caller's support tickets with its conversation (staff-internal notes excluded). Read-only.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ ticketId: z.string().min(1).max(64) }).strict(),
  outputSchema: z
    .object({
      id: z.string(),
      subject: z.string(),
      description: z.string(),
      status: z.string(),
      priority: z.string(),
      category: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      messages: z.array(z.object({ id: z.string(), content: z.string(), fromCustomer: z.boolean(), createdAt: z.string() }).strict()).max(50),
      messagesTruncated: z.boolean(),
    })
    .strict(),
  errorContract: [{ code: "RESOURCE_NOT_FOUND", description: "No ticket exists, or it is not the caller's." }],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Ticket", resourceLocator: "ticketId" },
  permission: { permission: "read:tickets" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry.", class: "IDEMPOTENT" },
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "tickets.getAdapter" },
  securityClassification: "INTERNAL/CONFIDENTIAL — owner-scoped; internal notes and staff identities excluded.",
  contentTrust: "THIRD_PARTY_CONTENT",
}

const analyticsSummary: CapabilityDefinition = {
  id: "analytics.summary",
  version: 1,
  domain: "analytics",
  name: "My account summary",
  description: "Counts of the caller's own subscriptions, tickets and (for vendors) products. Read-only.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({}).strict(),
  outputSchema: z
    .object({
      subscriptions: z.object({ active: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).strict(),
      tickets: z.object({ open: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).strict(),
      products: z.object({ published: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).strict().nullable(),
    })
    .strict(),
  errorContract: [],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "AccountSummary" },
  permission: { permission: "read:analytics" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry.", class: "IDEMPOTENT" },
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "analytics.summaryAdapter" },
  securityClassification: "INTERNAL — owner-scoped counts only; platform-wide analytics are not agent-available.",
  contentTrust: "SYSTEM_GENERATED",
}

const analyticsProductPerformance: CapabilityDefinition = {
  id: "analytics.productPerformance",
  version: 1,
  domain: "analytics",
  name: "My product performance",
  description: "Views, cart adds, checkouts, purchases and rating of one of the caller's vendor products over 7, 30 or 90 days. Read-only.",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ productId: z.string().min(1).max(64), days: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional() }).strict(),
  outputSchema: z
    .object({
      productId: z.string(),
      days: z.number().int(),
      views: z.number().int().nonnegative(),
      cartAdds: z.number().int().nonnegative(),
      checkoutsStarted: z.number().int().nonnegative(),
      purchases: z.number().int().nonnegative(),
      conversionRate: z.number().min(0).nullable(),
      averageRating: z.number(),
      reviewCount: z.number().int().nonnegative(),
    })
    .strict(),
  errorContract: [{ code: "RESOURCE_NOT_FOUND", description: "No product exists, or it is not the caller's." }],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Product", resourceLocator: "productId" },
  permission: { permission: "read:analytics" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Safe to retry.", class: "IDEMPOTENT" },
  async: READ_ASYNC_SUPPORT,
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A — read-only." },
  executionReference: { adapterKey: "analytics.productPerformanceAdapter" },
  securityClassification: "INTERNAL — the vendor's own product only; counts, no buyer data.",
  contentTrust: "SYSTEM_GENERATED",
}

// ── Phase 13 — first executable writes (LOW_RISK_WRITE, support domain) ──

/** Writes run synchronously (with an idempotency key) or through the task engine. */
const WRITE_ASYNC_SUPPORT: CapabilityDefinition["async"] = {
  executionMode: "SYNC",
  asyncSupported: true,
  queue: "agent-task",
  worker: "agent-task",
  pollingSupported: true,
}

const ticketsCreate: CapabilityDefinition = {
  id: "tickets.create",
  version: 1,
  domain: "tickets",
  name: "Open a support ticket",
  description: "Open a support ticket for the caller. Requires an idempotency key. Compensated by closing the ticket.",
  status: "ACTIVE",
  operationType: "LOW_RISK_WRITE",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z
    .object({
      subject: z.string().min(3).max(200),
      description: z.string().min(10).max(5000),
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
      category: z.enum(["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT", "PRODUCT", "OTHER"]).optional(),
    })
    .strict(),
  outputSchema: z.object({ id: z.string(), subject: z.string(), status: z.string(), priority: z.string(), category: z.string(), createdAt: z.string() }).strict(),
  errorContract: [
    { code: "INVALID_INPUT", description: "Subject or description missing or malformed." },
    { code: "IDEMPOTENCY_KEY_REQUIRED", description: "No idempotency key was supplied." },
  ],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Ticket" },
  permission: { permission: "write:tickets" },
  sideEffects: { effects: ["database write (Ticket)"] },
  idempotency: {
    requiresIdempotencyKey: true,
    idempotencyScope: "connectionId+idempotencyKey",
    retrySafe: false,
    duplicateBehavior: "Ticket has no natural unique key: a retry without the same idempotency key opens a second ticket.",
    class: "NON_IDEMPOTENT",
  },
  async: WRITE_ASYNC_SUPPORT,
  rollback: {
    reversibility: "REVERSIBLE",
    mechanism: "Close the ticket (tickets.close). The ticket stays on record.",
    recovery: {
      class: "COMPENSATABLE",
      capabilityId: "tickets.close",
      capabilityVersion: 1,
      inputMapping: { ticketId: "output.id" },
      residualEffects: "The ticket remains on record as CLOSED; staff may already have seen it.",
      manualRecoveryRequired: false,
      recommendation: "Close the ticket opened by the agent; tell support staff if it was already being worked on.",
    },
  },
  executionReference: { adapterKey: "tickets.createAdapter" },
  securityClassification: "INTERNAL/CONFIDENTIAL — always created for the connection owner; no project linkage; CRITICAL priority is staff-only.",
  contentTrust: "THIRD_PARTY_CONTENT",
}

const ticketsClose: CapabilityDefinition = {
  id: "tickets.close",
  version: 1,
  domain: "tickets",
  name: "Close a support ticket",
  description: "Close one of the caller's support tickets. Closing a closed ticket changes nothing.",
  status: "ACTIVE",
  operationType: "LOW_RISK_WRITE",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ ticketId: z.string().min(1).max(64) }).strict(),
  outputSchema: z.object({ id: z.string(), status: z.string(), changed: z.boolean() }).strict(),
  errorContract: [
    { code: "RESOURCE_NOT_FOUND", description: "No ticket exists, or it is not the caller's." },
    { code: "CONFLICT", description: "The ticket changed while it was being closed." },
  ],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Ticket", resourceLocator: "ticketId" },
  permission: { permission: "write:tickets" },
  sideEffects: { effects: ["database write (Ticket.status)"] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "End-state idempotent: closing a CLOSED ticket is a no-op (changed: false).", class: "IDEMPOTENT" },
  async: WRITE_ASYNC_SUPPORT,
  rollback: {
    reversibility: "REVERSIBLE",
    mechanism: "Support staff can reopen the ticket from the admin ticket view; there is no agent-side reopen.",
    recovery: {
      class: "IRREVERSIBLE",
      manualRecoveryRequired: true,
      recommendation: "Ask support staff to reopen the ticket from the admin ticket view (no agent capability reopens tickets).",
    },
  },
  executionReference: { adapterKey: "tickets.closeAdapter" },
  securityClassification: "INTERNAL/CONFIDENTIAL — owner-scoped; only the client 'close' transition, never staff transitions.",
  contentTrust: "SYSTEM_GENERATED",
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
  contentTrust: "THIRD_PARTY_CONTENT",
}

const productsUpdate: CapabilityDefinition = {
  id: "products.update",
  version: 1,
  domain: "products",
  name: "Update product",
  description: "Updates an existing product's basic details. Vendor-scoped: only the product owner can update DRAFT products.",
  status: "ACTIVE",
  operationType: "LOW_RISK_WRITE",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z
    .object({
      productId: z.string().min(1),
      name: z.string().min(1).max(200).optional(),
      tagline: z.string().min(1).max(300).optional(),
      description: z.string().min(1).max(5000).optional(),
      longDescription: z.string().max(20000).optional(),
      type: z.enum(["SAAS", "SERVICE", "AI_AGENT", "AI_TOOL", "WEBSITE", "AUTOMATION", "API", "TEMPLATE", "PLUGIN", "PROMPT", "WORKFLOW", "DIGITAL"]).optional(),
      category: z.string().max(100).optional(),
      tags: z.array(z.string().max(50)).max(20).optional(),
      thumbnailUrl: z.string().url().optional(),
      iconUrl: z.string().url().optional(),
      demoUrl: z.string().url().optional(),
      documentationUrl: z.string().url().optional(),
    })
    .strict(),
  outputSchema: z.object({ id: z.string(), name: z.string(), slug: z.string(), status: z.string(), updatedAt: z.string(), changed: z.boolean() }).strict(),
  errorContract: [
    { code: "INVALID_INPUT", description: "Update fields failed validation." },
    { code: "RESOURCE_NOT_FOUND", description: "No product exists for the given id." },
    { code: "PERMISSION_DENIED", description: "You can only update your own DRAFT products." },
  ],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Product", resourceLocator: "productId" },
  permission: { permission: "write:products" },
  sideEffects: {
    effects: ["database write (Product, ProductVersion, AuditLog)"],
    emitsEvents: ["PRODUCT_UPDATED"],
  },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Updates are conditional on ownership; retries are safe.", class: "IDEMPOTENT" },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "Restore from ProductVersion snapshot." },
  executionReference: { adapterKey: "products.updateAdapter" },
  securityClassification: "INTERNAL — vendor-scoped drafts.",
  contentTrust: "THIRD_PARTY_CONTENT",
}

const productsArchive: CapabilityDefinition = {
  id: "products.archive",
  version: 1,
  domain: "products",
  name: "Archive product",
  description: "Soft-deletes a product by setting status to ARCHIVED. Vendor-scoped: only the product owner can archive. Idempotent.",
  status: "ACTIVE",
  operationType: "LOW_RISK_WRITE",
  exposure: "AGENT_AVAILABLE",
  inputSchema: z.object({ productId: z.string().min(1) }).strict(),
  outputSchema: z.object({ id: z.string(), name: z.string(), status: z.string(), changed: z.boolean() }).strict(),
  errorContract: [
    { code: "RESOURCE_NOT_FOUND", description: "No product exists for the given id." },
    { code: "PERMISSION_DENIED", description: "You can only archive your own products." },
    { code: "CONFLICT", description: "The product changed while it was being archived." },
  ],
  requiredIdentityContext: ["connectionId", "ownerId"],
  resource: { resourceType: "Product", resourceLocator: "productId" },
  permission: { permission: "write:products" },
  sideEffects: {
    effects: ["database write (Product, ProductVersion, AuditLog)"],
    emitsEvents: ["PRODUCT_ARCHIVED"],
  },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "Archiving an already-archived product returns the same result (changed: false).", class: "IDEMPOTENT" },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "Change status back to DRAFT (products.update)." },
  executionReference: { adapterKey: "products.archiveAdapter" },
  securityClassification: "INTERNAL — vendor-scoped products.",
  contentTrust: "THIRD_PARTY_CONTENT",
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
  contentTrust: "THIRD_PARTY_CONTENT",
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
  contentTrust: "SYSTEM_GENERATED",
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
  // Phase 13
  productsListMine,
  campaignsGetActive,
  subscriptionsList,
  ticketsGet,
  analyticsSummary,
  analyticsProductPerformance,
  ticketsCreate,
  ticketsClose,
  productsCreateDraft,
  productsUpdate,
  productsArchive,
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
