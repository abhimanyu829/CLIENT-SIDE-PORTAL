/**
 * lib/agent-gateway/execution/adapters/analytics-product-performance-adapter.ts
 *
 * Phase 13 — capability "analytics.productPerformance": the funnel of ONE
 * product owned by the connection owner's vendor profile, over a fixed
 * window (7 / 30 / 90 days, the windows of the existing analytics route),
 * from the existing `PlatformMetricEvent` stream (VIEW, CART_ADD,
 * CHECKOUT_STARTED, PURCHASE) plus the product's own rating counters.
 *
 * Ownership: the product's vendor profile must belong to `context.ownerId`;
 * not-found and not-owned are the same RESOURCE_NOT_FOUND. Counts only:
 * no buyer identities, sessions, order ids, revenue or event metadata.
 */
import { db } from "@/lib/db"
import type { MetricEventType } from "@prisma/client"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface ProductPerformanceInput {
  productId: string
  days?: 7 | 30 | 90
}

export interface ProductPerformanceOutput {
  productId: string
  days: number
  views: number
  cartAdds: number
  checkoutsStarted: number
  purchases: number
  conversionRate: number | null
  averageRating: number
  reviewCount: number
}

const FUNNEL: ReadonlyArray<[keyof Pick<ProductPerformanceOutput, "views" | "cartAdds" | "checkoutsStarted" | "purchases">, MetricEventType]> = [
  ["views", "VIEW"],
  ["cartAdds", "CART_ADD"],
  ["checkoutsStarted", "CHECKOUT_STARTED"],
  ["purchases", "PURCHASE"],
]

/** The owner's product (through its vendor profile), or the one RESOURCE_NOT_FOUND for missing and not-owned alike. */
async function findOwnedProduct(context: AgentExecutionContext, productId: unknown) {
  const product =
    typeof productId === "string"
      ? await db.product.findUnique({
          where: { id: productId },
          select: { id: true, vendorId: true, averageRating: true, reviewCount: true },
        })
      : null
  const vendor = product?.vendorId ? await db.vendorProfile.findUnique({ where: { id: product.vendorId }, select: { userId: true } }) : null
  if (!product || !vendor || vendor.userId !== context.ownerId) {
    throw new ExecutionError("RESOURCE_NOT_FOUND", "No product exists for the given id.")
  }
  return product
}

export class AnalyticsProductPerformanceAdapter implements AgentCapabilityAdapter<ProductPerformanceInput, ProductPerformanceOutput> {
  readonly capabilityId = "analytics.productPerformance"
  readonly capabilityVersion = 1

  /** Read-only preflight used by the gate before an approval (contracts/adapter.ts). */
  async checkResource(context: AgentExecutionContext, input: ProductPerformanceInput): Promise<void> {
    await findOwnedProduct(context, input?.productId)
  }

  async execute(context: AgentExecutionContext, input: ProductPerformanceInput): Promise<ExecutionResult<ProductPerformanceOutput>> {
    const startedAt = Date.now()
    if (context.signal.aborted) throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    const product = await findOwnedProduct(context, input.productId)
    const days = input.days ?? 30
    const since = new Date(context.timestamp.getTime() - days * 86_400_000)
    const counts = await Promise.all(FUNNEL.map(([, type]) => db.platformMetricEvent.count({ where: { productId: product.id, type, occurredAt: { gte: since } } })))
    const funnel = Object.fromEntries(FUNNEL.map(([key], i) => [key, counts[i]])) as Record<(typeof FUNNEL)[number][0], number>
    return {
      output: {
        productId: product.id,
        days,
        ...funnel,
        conversionRate: funnel.views > 0 ? Math.round((funnel.purchases / funnel.views) * 10_000) / 10_000 : null,
        averageRating: product.averageRating,
        reviewCount: product.reviewCount,
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
