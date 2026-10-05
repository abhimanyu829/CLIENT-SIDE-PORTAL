/**
 * lib/agent-gateway/execution/adapters/products-create-draft-adapter.ts
 *
 * Phase 13 — capability "products.createDraft": creates a new product in
 * DRAFT status. Traces to the admin `createProduct` server action with
 * these deliberate divergences:
 *
 *   - `createdBy` is derived from the connection's ownerId, not requireAdmin()
 *   - Status is ALWAYS "DRAFT" (agents cannot publish directly)
 *   - vendorId is set to context.ownerId (vendor-scoped creation)
 *   - Minimal required fields only (name, slug, tagline, description, type)
 *
 * Recovery: COMPENSATABLE through products.archive (soft delete).
 */
import { db } from "@/lib/db"
import type { ProductType } from "@prisma/client"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export const PRODUCT_TYPES = ["SAAS", "SERVICE", "AI_AGENT", "AI_TOOL", "WEBSITE", "AUTOMATION", "API", "TEMPLATE", "PLUGIN", "PROMPT", "WORKFLOW", "DIGITAL"] as const

export interface ProductsCreateDraftInput {
  name: string
  slug: string
  tagline: string
  description: string
  type: (typeof PRODUCT_TYPES)[number]
  category?: string
  tags?: string[]
}

export interface ProductsCreateDraftOutput {
  id: string
  name: string
  slug: string
  status: string
  type: string
  createdAt: string
}

export class ProductsCreateDraftAdapter implements AgentCapabilityAdapter<ProductsCreateDraftInput, ProductsCreateDraftOutput> {
  readonly capabilityId = "products.createDraft"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, input: ProductsCreateDraftInput): Promise<ExecutionResult<ProductsCreateDraftOutput>> {
    const startedAt = Date.now()

    // Validate required fields
    const name = input.name?.trim()
    const slug = input.slug?.trim()
    const tagline = input.tagline?.trim()
    const description = input.description?.trim()

    if (!name || !slug || !tagline || !description) {
      throw new ExecutionError("INVALID_INPUT", "name, slug, tagline, and description are required.")
    }

    if (!PRODUCT_TYPES.includes(input.type)) {
      throw new ExecutionError("INVALID_INPUT", `type must be one of: ${PRODUCT_TYPES.join(", ")}`)
    }

    if (context.signal.aborted) {
      throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    }

    // Check for duplicate slug
    const existing = await db.product.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (existing) {
      throw new ExecutionError("CONFLICT", `A product with slug "${slug}" already exists.`)
    }

    // Create product with transaction
    const product = await db.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name,
          slug,
          tagline,
          description,
          longDescription: description, // Use description as long description initially
          type: input.type as ProductType,
          category: input.category || null,
          status: "DRAFT", // Always DRAFT for agent-created products
          vendorId: context.ownerId, // Vendor-scoped
          isPremium: false,
          proPoints: 0,
          tags: input.tags ?? [],
          features: {},
          previewEnabled: false,
          previewConfig: {},
          deliveryConfig: {},
          screenshotUrls: [],
          videoUrls: [],
          seoKeywords: [],
          techStack: [],
          createdBy: context.ownerId,
          lastEditedBy: context.ownerId,
          version: 1,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          type: true,
          createdAt: true,
        },
      })

      // Create initial version snapshot
      await tx.productVersion.create({
        data: {
          productId: newProduct.id,
          version: 1,
          snapshot: {
            name: newProduct.name,
            slug: newProduct.slug,
            tagline,
            description,
            type: newProduct.type,
            status: newProduct.status,
            createdAt: newProduct.createdAt.toISOString(),
          },
          changedBy: context.ownerId,
          changedByName: "Agent", // Could be enhanced with connection name
          changeNote: "Initial creation via agent",
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: context.ownerId,
          action: "PRODUCT_CREATED",
          entity: "Product",
          entityId: newProduct.id,
          afterJson: {
            name: newProduct.name,
            slug: newProduct.slug,
            type: newProduct.type,
            status: newProduct.status,
            category: input.category,
          },
        },
      })

      return newProduct
    })

    return {
      output: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        status: product.status,
        type: product.type,
        createdAt: product.createdAt.toISOString(),
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
