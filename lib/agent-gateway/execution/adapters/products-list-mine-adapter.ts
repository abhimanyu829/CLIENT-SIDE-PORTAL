/**
 * lib/agent-gateway/execution/adapters/products-list-mine-adapter.ts
 *
 * Phase 13 — capability "products.listMine": the products of the vendor
 * profile(s) owned by the connection's owner, any status (a vendor sees
 * their own drafts). Traces to the existing vendor ownership model
 * (`VendorProfile.userId` -> `Product.vendorId`, the same relation the
 * vendor dashboard reads).
 *
 * Ownership comes ONLY from `context.ownerId` (Phase 2 machine identity).
 * A caller without a vendor profile gets an empty list (never someone
 * else's catalogue). Explicit select: no delivery configuration, access
 * URLs, credentials, pricing internals or embedding.
 */
import { db } from "@/lib/db"
import type { ProductStatus } from "@prisma/client"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface ProductsListMineInput {
  status?: string
  limit?: number
}

export interface ProductsListMineOutput {
  items: Array<{ id: string; name: string; slug: string; status: string; type: string }>
}

const LIMIT_CAP = 50
const MAX_VENDOR_PROFILES = 10
export const PRODUCT_STATUSES = new Set(["DRAFT", "AVAILABLE", "RESERVED", "EXPIRED", "REPUBLISH_PENDING", "SCHEDULED", "ARCHIVED", "HIDDEN", "MAINTENANCE"])

export class ProductsListMineAdapter implements AgentCapabilityAdapter<ProductsListMineInput, ProductsListMineOutput> {
  readonly capabilityId = "products.listMine"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, input: ProductsListMineInput): Promise<ExecutionResult<ProductsListMineOutput>> {
    const startedAt = Date.now()
    if (input.status !== undefined && !PRODUCT_STATUSES.has(input.status)) {
      throw new ExecutionError("INVALID_INPUT", `Unsupported product status: "${input.status}".`)
    }
    if (context.signal.aborted) throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")

    const vendors = await db.vendorProfile.findMany({ where: { userId: context.ownerId }, select: { id: true }, take: MAX_VENDOR_PROFILES })
    if (vendors.length === 0) return { output: { items: [] }, executionMode: "SYNC", durationMs: Date.now() - startedAt }

    const products = await db.product.findMany({
      where: {
        vendorId: { in: vendors.map((v) => v.id) },
        ...(input.status ? { status: input.status as ProductStatus } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(input.limit ?? 20, LIMIT_CAP),
      select: { id: true, name: true, slug: true, status: true, type: true },
    })
    return {
      output: { items: products.map((p) => ({ id: p.id, name: p.name, slug: p.slug, status: p.status, type: p.type })) },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
