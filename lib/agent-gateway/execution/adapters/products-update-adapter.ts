/**
 * lib/agent-gateway/execution/adapters/products-update-adapter.ts
 *
 * Phase 13 — capability "products.update": updates an existing product's
 * basic details. Vendor-scoped: only the product owner can update.
 * Divergences from admin route:
 *
 *   - Only allows updating DRAFT products (published products require admin approval)
 *   - Vendor can only update their own products (vendorId check)
 *   - Cannot change status, isPremium, proPoints, or financial settings
 *   - Creates version snapshot for audit trail
 */
import { db } from "@/lib/db"
import type { ProductType } from "@prisma/client"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export const PRODUCT_TYPES = ["SAAS", "SERVICE", "AI_AGENT", "AI_TOOL", "WEBSITE", "AUTOMATION", "API", "TEMPLATE", "PLUGIN", "PROMPT", "WORKFLOW", "DIGITAL"] as const

export interface ProductsUpdateInput {
  productId: string
  name?: string
  tagline?: string
  description?: string
  longDescription?: string
  type?: (typeof PRODUCT_TYPES)[number]
  category?: string
  tags?: string[]
  thumbnailUrl?: string
  iconUrl?: string
  demoUrl?: string
  documentationUrl?: string
}

export interface ProductsUpdateOutput {
  id: string
  name: string
  slug: string
  status: string
  updatedAt: string
  changed: boolean
}

/** Find the product and verify ownership */
async function findOwnedProduct(context: AgentExecutionContext, productId: unknown) {
  const product =
    typeof productId === "string"
      ? await db.product.findUnique({
          where: { id: productId },
          select: { id: true, vendorId: true, status: true, name: true, slug: true, version: true, updatedAt: true },
        })
      : null

  if (!product) {
    throw new ExecutionError("RESOURCE_NOT_FOUND", "No product exists for the given id.")
  }

  if (product.vendorId !== context.ownerId) {
    throw new ExecutionError("PERMISSION_DENIED", "You can only update your own products.")
  }

  if (product.status !== "DRAFT") {
    throw new ExecutionError("PERMISSION_DENIED", "Only DRAFT products can be updated. Published products require admin approval.")
  }

  return product
}

export class ProductsUpdateAdapter implements AgentCapabilityAdapter<ProductsUpdateInput, ProductsUpdateOutput> {
  readonly capabilityId = "products.update"
  readonly capabilityVersion = 1

  /** Read-only preflight used by the gate before an approval */
  async checkResource(context: AgentExecutionContext, input: ProductsUpdateInput): Promise<void> {
    await findOwnedProduct(context, input?.productId)
  }

  async execute(context: AgentExecutionContext, input: ProductsUpdateInput): Promise<ExecutionResult<ProductsUpdateOutput>> {
    const startedAt = Date.now()

    if (context.signal.aborted) {
      throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    }

    const product = await findOwnedProduct(context, input.productId)

    // Build update data (only allow safe fields)
    const updateData: any = {
      lastEditedBy: context.ownerId,
      version: { increment: 1 },
    }

    let hasChanges = false

    if (input.name !== undefined && input.name.trim()) {
      updateData.name = input.name.trim()
      hasChanges = true
    }
    if (input.tagline !== undefined && input.tagline.trim()) {
      updateData.tagline = input.tagline.trim()
      hasChanges = true
    }
    if (input.description !== undefined && input.description.trim()) {
      updateData.description = input.description.trim()
      hasChanges = true
    }
    if (input.longDescription !== undefined) {
      updateData.longDescription = input.longDescription?.trim() || null
      hasChanges = true
    }
    if (input.type !== undefined) {
      if (!PRODUCT_TYPES.includes(input.type)) {
        throw new ExecutionError("INVALID_INPUT", `type must be one of: ${PRODUCT_TYPES.join(", ")}`)
      }
      updateData.type = input.type
      hasChanges = true
    }
    if (input.category !== undefined) {
      updateData.category = input.category || null
      hasChanges = true
    }
    if (input.tags !== undefined) {
      updateData.tags = input.tags
      hasChanges = true
    }
    if (input.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = input.thumbnailUrl || null
      hasChanges = true
    }
    if (input.iconUrl !== undefined) {
      updateData.iconUrl = input.iconUrl || null
      hasChanges = true
    }
    if (input.demoUrl !== undefined) {
      updateData.demoUrl = input.demoUrl || null
      hasChanges = true
    }
    if (input.documentationUrl !== undefined) {
      updateData.documentationUrl = input.documentationUrl || null
      hasChanges = true
    }

    // If no changes, return current state
    if (!hasChanges) {
      return {
        output: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          status: product.status,
          updatedAt: product.updatedAt.toISOString(),
          changed: false,
        },
        executionMode: "SYNC",
        durationMs: Date.now() - startedAt,
      }
    }

    // Update with transaction
    const updated = await db.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: product.id, vendorId: context.ownerId }, // Double-check ownership
        data: updateData,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          updatedAt: true,
          version: true,
        },
      })

      // Create version snapshot
      await tx.productVersion.create({
        data: {
          productId: updatedProduct.id,
          version: updatedProduct.version,
          snapshot: { ...input, updatedAt: updatedProduct.updatedAt.toISOString() },
          changedBy: context.ownerId,
          changedByName: "Agent",
          changeNote: "Updated via agent",
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: context.ownerId,
          action: "PRODUCT_UPDATED",
          entity: "Product",
          entityId: updatedProduct.id,
          afterJson: { ...input, version: updatedProduct.version },
        },
      })

      return updatedProduct
    })

    return {
      output: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
        changed: true,
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
