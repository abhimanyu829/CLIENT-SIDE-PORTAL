/**
 * lib/agent-gateway/execution/adapters/index.ts
 *
 * Registers every Phase 4 adapter into an `AdapterRegistry`. This is the
 * execution-layer analog of Phase 3's `manifest.ts`'s
 * `registerCoreCapabilities()` — same trust boundary (module-init-time
 * only), same fail-closed behavior (if any single adapter fails to
 * register, the whole load throws rather than leaving a partial set).
 *
 * ONLY the 4 capabilities the Phase 4 Step 0 audit confirmed have a safe,
 * traceable existing service are registered here. `products.createDraft`
 * and `coupons.create` are Phase 3 AGENT_AVAILABLE capabilities that
 * intentionally have NO adapter registered — see
 * docs/agent-gateway/phase-4/04-existing-service-mapping.md for the full
 * justification (both require a real Clerk human admin session via
 * `requireAdmin()`, and no service-principal/delegation mechanism exists
 * anywhere in this codebase to safely construct a machine-identity
 * equivalent). `products.updatePricing` (INTERNAL_ONLY) and
 * `refunds.process` (FORBIDDEN) were already correctly modeled as
 * non-executable by Phase 3 and require no adapter either.
 */
import type { AdapterRegistry } from "../resolver/adapter-registry"
import { ProductsListAdapter } from "./products-list-adapter"
import { ProductsGetAdapter } from "./products-get-adapter"
import { SubscriptionsGetAdapter } from "./subscriptions-get-adapter"
import { TicketsListAdapter } from "./tickets-list-adapter"
// Phase 13 — domain expansion (docs/agent-gateway/phase-13/07-capability-map.md).
import { ProductsListMineAdapter } from "./products-list-mine-adapter"
import { CampaignsGetActiveAdapter } from "./campaigns-get-active-adapter"
import { SubscriptionsListAdapter } from "./subscriptions-list-adapter"
import { TicketsGetAdapter } from "./tickets-get-adapter"
import { TicketsCreateAdapter } from "./tickets-create-adapter"
import { TicketsCloseAdapter } from "./tickets-close-adapter"
import { AnalyticsSummaryAdapter } from "./analytics-summary-adapter"
import { AnalyticsProductPerformanceAdapter } from "./analytics-product-performance-adapter"

export function registerCoreAdapters(registry: AdapterRegistry): void {
  registry.register(new ProductsListAdapter())
  registry.register(new ProductsGetAdapter())
  registry.register(new SubscriptionsGetAdapter())
  registry.register(new TicketsListAdapter())
  registry.register(new ProductsListMineAdapter())
  registry.register(new CampaignsGetActiveAdapter())
  registry.register(new SubscriptionsListAdapter())
  registry.register(new TicketsGetAdapter())
  registry.register(new TicketsCreateAdapter())
  registry.register(new TicketsCloseAdapter())
  registry.register(new AnalyticsSummaryAdapter())
  registry.register(new AnalyticsProductPerformanceAdapter())
}
