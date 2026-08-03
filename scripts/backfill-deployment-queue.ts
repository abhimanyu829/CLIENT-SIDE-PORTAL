/**
 * One-off repair: create missing deployment queue jobs for orders that were
 * paid while the queue trigger was broken. Reuses the shared
 * createPurchasedServicesForOrder() — no duplicated logic. Idempotent.
 *
 * Run: npx ts-node --transpile-only --compiler-options '{"module":"commonjs"}' -r tsconfig-paths/register scripts/backfill-deployment-queue.ts
 */
import { db } from "../lib/db"
import { createPurchasedServicesForOrder } from "../lib/services/service-lifecycle-service"

async function main() {
  // Legacy rows created before the deployment package existed carry an empty
  // config. Remove them (cascades to deployment + timeline) so they are
  // recreated below with the complete package.
  const legacy = await db.purchasedService.findMany({
    where: { status: "PENDING_DEPLOYMENT" },
    select: { id: true, config: true },
  })
  for (const svc of legacy) {
    const config = (svc.config as Record<string, unknown>) ?? {}
    if (!config.deploymentPackage) {
      console.log(`Removing legacy package-less service ${svc.id} (will be recreated with full package)`)
      await db.purchasedService.delete({ where: { id: svc.id } })
    }
  }

  const paidOrders = await db.order.findMany({
    where: { status: { in: ["PAID", "FULFILLED"] } },
    select: {
      id: true,
      orderNumber: true,
      items: { select: { id: true } },
      purchasedServices: { select: { orderItemId: true } },
    },
  })

  let healedOrders = 0
  for (const order of paidOrders) {
    const covered = new Set(order.purchasedServices.map((s) => s.orderItemId))
    const missing = order.items.filter((item) => !covered.has(item.id)).length
    if (missing === 0) continue
    await createPurchasedServicesForOrder(order.id)
    healedOrders++
    console.log(`Healed ${order.orderNumber} — ${missing} queue job(s) created`)
  }

  const totalDeployments = await db.serviceDeployment.count()
  console.log(`Done — ${healedOrders} order(s) healed. Total deployment queue jobs: ${totalDeployments}`)
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
