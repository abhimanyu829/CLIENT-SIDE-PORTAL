/**
 * lib/agent-gateway/execution/adapters/products-get-adapter.ts
 *
 * Binds capability "products.get" to the EXISTING product-detail query
 * — the same `db.product.findUnique` model access used by
 * `app/api/products/[slug]/route.ts`'s `GET` handler, adapted to look up
 * by `id` (the capability's declared input) rather than `slug` (the real
 * route's own lookup key) — same model, same underlying data, different
 * lookup key, which is a deliberate, documented translation, not a
 * duplicate implementation.
 *
 * Deliberately OMITTED from this adapter: the real route's fire-and-forget
 * `viewCount` increment side effect. The capability's own Phase 3 contract
 * declares `sideEffects.effects: []` and `operationType: "READ"` — an AI-
 * driven read incrementing a public view counter would violate that
 * contract, so this adapter intentionally does not replicate it.
 */
import { db } from "@/lib/db"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface ProductsGetInput {
  id: string
}

export interface ProductSummary {
  id: string
  name: string
  slug: string
  status: string
  type: string
}

export class ProductsGetAdapter implements AgentCapabilityAdapter<ProductsGetInput, ProductSummary> {
  readonly capabilityId = "products.get"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, input: ProductsGetInput): Promise<ExecutionResult<ProductSummary>> {
    const startedAt = Date.now()

    if (context.signal.aborted) {
      throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    }

    // Same model access as [slug]/route.ts, keyed by id instead of slug
    // per this capability's declared input contract.
    const product = await db.product.findUnique({
      where: { id: input.id },
      select: { id: true, name: true, slug: true, status: true, type: true },
    })

    // Phase 12 (data exfiltration): an agent reads the PUBLISHED catalog
    // only, exactly like products.list. DRAFT / ARCHIVED products are not
    // public; they are reported as not found, indistinguishable from a
    // missing id, so the capability cannot probe unpublished products.
    // (The human /api/products/[slug] route applies the same rule since the
    // PRE-12-1 fix.)
    if (!product || product.status !== "AVAILABLE") {
      // Mirrors the real route's explicit 404 semantics (Phase 0/4 error
      // translation table: "resource missing -> RESOURCE_NOT_FOUND").
      throw new ExecutionError("RESOURCE_NOT_FOUND", "No product exists for the given id.")
    }

    return {
      output: product,
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
