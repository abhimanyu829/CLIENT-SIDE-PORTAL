/**
 * lib/agent-gateway/execution/adapters/products-list-adapter.ts
 *
 * Binds capability "products.list" to the EXISTING public catalog query
 * — the same `db.product.findMany` shape used by
 * `app/api/products/route.ts`'s `GET` handler. This adapter does NOT
 * duplicate that route; it calls the identical Prisma query directly
 * (no internal HTTP round-trip) so the AI-facing result matches exactly
 * what the public storefront already returns for the same filters.
 *
 * Known, documented divergence from the Phase 3 manifest's declared
 * input schema (see docs/agent-gateway/phase-4/04-existing-service-mapping.md):
 *   - `status`: the real service ALWAYS forces `status: "AVAILABLE"` —
 *     there is no way to list DRAFT/ARCHIVED products through this public
 *     path, by design (that's admin-only). Any non-"AVAILABLE" `status`
 *     input is rejected with INVALID_INPUT rather than silently ignored,
 *     so a caller is never misled into thinking a filter was honored.
 *   - `category`: the real service has NO category filter at all (it
 *     filters by `type`, not `category`). Declared unsupported the same
 *     way — rejected with INVALID_INPUT rather than a silent no-op.
 *   - `limit`: the manifest declares max 100, but the real service caps
 *     at 50. This adapter honors the TIGHTER existing cap (50), since
 *     Phase 4's core principle is to preserve existing behavior exactly,
 *     never to relax it.
 */
import { db } from "@/lib/db"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface ProductsListInput {
  status?: string
  category?: string
  limit?: number
}

export interface ProductSummary {
  id: string
  name: string
  slug: string
  status: string
  type: string
}

export interface ProductsListOutput {
  items: ProductSummary[]
}

const EXISTING_SERVICE_LIMIT_CAP = 50 // matches app/api/products/route.ts's own cap exactly

export class ProductsListAdapter implements AgentCapabilityAdapter<ProductsListInput, ProductsListOutput> {
  readonly capabilityId = "products.list"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, input: ProductsListInput): Promise<ExecutionResult<ProductsListOutput>> {
    const startedAt = Date.now()

    if (input.status !== undefined && input.status !== "AVAILABLE") {
      throw new ExecutionError(
        "INVALID_INPUT",
        'The existing product listing service only supports status "AVAILABLE" (the public catalog view). Other statuses are admin-only and not exposed through this capability.'
      )
    }
    if (input.category !== undefined) {
      throw new ExecutionError(
        "INVALID_INPUT",
        "The existing product listing service does not support filtering by category. This is a known gap between the capability contract and the real service (see Phase 4 docs)."
      )
    }

    const limit = Math.min(input.limit ?? 12, EXISTING_SERVICE_LIMIT_CAP)

    if (context.signal.aborted) {
      throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    }

    // Identical query shape to app/api/products/route.ts's GET handler —
    // no new business logic, same where/orderBy/take as the public route.
    const products = await db.product.findMany({
      where: { status: "AVAILABLE" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, name: true, slug: true, status: true, type: true },
    })

    return {
      output: { items: products },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
