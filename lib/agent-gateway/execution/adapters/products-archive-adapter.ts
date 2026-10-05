/**
 * lib/agent-gateway/execution/adapters/products-archive-adapter.ts
 *
 * Phase 13 — capability "products.archive": soft-deletes a product by
 * setting status to ARCHIVED. Vendor-scoped: only the product owner can archive.
 *
 * End-state idempotent: archiving an ARCHIVED product changes nothing and
 * returns the same result (`changed: false`), so a retry is harmless.
 *
 * Recovery: serves as the compensation handler for products.createDraft.
 */
import { db } from "@/lib/db"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface ProductsArchiveInput {
  productId: string
}

export interface ProductsArchiveOutput {
  id: string
  name: string
  status: string
  changed: boolean
}

/** Find the product and verify ownership */
async function findOwnedProduct(context: AgentExecutionContext, productId: unknown) {
  const product =
    typeof productId === "string"
      ? await db.product.findUnique({
          where: { id: productId },
          select: { id: true, vendorId: true, status: true, name: true, version: true },
        })
      : null

  if (!product) {
    throw new ExecutionError("RESOURCE_NOT_FOUND", "No product exists for the given id.")
  }

  if (product.vendorId !== context.ownerId) {
    throw new ExecutionError("PERMISSION_DENIED", "You can only archive your own products.")
  }

  return product
}

export class ProductsArchiveAdapter implements AgentCapabilityAdapter<ProductsArchiveInput, ProductsArchiveOutput> {
  readonly capabilityId = "products.archive"
  readonly capabilityVersion = 1

  /** Read-only preflight used by the gate before an approval */
  async checkResource(context: AgentExecutionContext, input: ProductsArchiveInput): Promise<void> {
    await findOwnedProduct(context, input?.productId)
  }

  async execute(context: AgentExecutionContext, input: ProductsArchiveInput): Promise<ExecutionResult<ProductsArchiveOutput>> {
    const startedAt = Date.now()

    if (context.signal.aborted) {
      throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    }

    const product = await findOwnedProduct(context, input.productId)

    // Idempotent: already archived
    if (product.status === "ARCHIVED") {
      return {
        output: {
          id: product.id,
          name: product.name,
          status: "ARCHIVED",
          changed: false,
        },
        executionMode: "SYNC",
        durationMs: Date.now() - startedAt,
      }
    }

    // Archive the product
    const updated = await db.$transaction(async (tx) => {
      const archivedProduct = await tx.product.updateMany({
        where: { id: product.id, vendorId: context.ownerId }, // Double-check ownership
        data: {
          status: "ARCHIVED",
          lastEditedBy: context.ownerId,
          version: { increment: 1 },
        },
      })

      if (archivedProduct.count !== 1) {
        throw new ExecutionError("CONFLICT", "The product changed while it was being archived. Read it again.")
      }

      // Get updated product for response
      const updatedProduct = await tx.product.findUniqueOrThrow({
        where: { id: product.id },
        select: { id: true, name: true, status: true, version: true },
      })

      // Create version snapshot
      await tx.productVersion.create({
        data: {
          productId: updatedProduct.id,
          version: updatedProduct.version,
          snapshot: { status: "ARCHIVED", archivedAt: new Date().toISOString() },
          changedBy: context.ownerId,
          changedByName: "Agent",
          changeNote: "Archived via agent",
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: context.ownerId,
          action: "PRODUCT_ARCHIVED",
          entity: "Product",
          entityId: updatedProduct.id,
          afterJson: { status: "ARCHIVED" },
        },
      })

      return updatedProduct
    })

    return {
      output: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        changed: true,
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
