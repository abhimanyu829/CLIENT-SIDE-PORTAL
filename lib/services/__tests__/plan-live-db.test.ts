/**
 * Phase 2 — LIVE database verification (opt-in).
 *
 * Skipped by default. Runs the real catalog flow end-to-end against the
 * configured database when LIVE_DB=1:
 *   CREATE → DRAFT → EDIT → PUBLISH → V2 → PUBLISH → ARCHIVE
 * then asserts historical versions remain intact.
 *
 * Run: $env:LIVE_DB="1"; npm run test:plans -- plan-live-db
 *
 * Uses a clearly-marked slug prefix so residue is identifiable, and never
 * touches standalone commerce records.
 */
import { afterAll, describe, expect, it } from "vitest"
import { db } from "@/lib/db"
import {
  createPlan,
  addPlanItem,
  publishPlan,
  createDraftVersion,
  updateDraftVersion,
  archivePlan,
  getPlan,
} from "@/lib/services/plan-catalog-service"

const LIVE = process.env.LIVE_DB === "1"
const suite = LIVE ? describe : describe.skip

let planId: string | null = null
let productId: string | null = null
let actorId: string | null = null

suite("live DB verification — plan catalog", () => {
  it("CREATE → DRAFT → EDIT → PUBLISH → V2 → PUBLISH → ARCHIVE", async () => {
    // AuditLog.userId references User(id), so the actor must be a real user.
    actorId = (await db.user.findFirst({ select: { id: true } }))?.id ?? null
    if (!actorId) {
      console.warn("live verify skipped: no User row available for the audit actor")
      return
    }

    // A real product to reference (read-only use; never mutated).
    productId = process.env.LIVE_DB_SKIP_PRODUCT
      ? null
      : (await db.product.findFirst({ select: { id: true } }))?.id ?? null

    const slug = `verify-p2-${Date.now()}`
    const { plan, version } = await createPlan(
      { name: "Verify P2 Plan", slug, planType: "MONTHLY", currency: "INR", basePrice: 999 },
      actorId,
    )
    planId = plan.id
    expect(plan.status).toBe("DRAFT")

    if (!productId) {
      // No product in DB: use a declared limit item so publish still validates.
      await addPlanItem(version.id, { itemType: "STORAGE", limitValue: 5, limitUnit: "GB" }, actorId)
    } else {
      await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: productId }, actorId)
    }

    const v1p = await publishPlan(plan.id, actorId)
    expect(v1p.plan.status).toBe("PUBLISHED")
    expect(v1p.version.status).toBe("PUBLISHED")

    const v2 = await createDraftVersion(plan.id, { price: 1499 }, actorId)
    await updateDraftVersion(v2.id, { price: 1599 }, actorId)
    await addPlanItem(v2.id, { itemType: "STORAGE", limitValue: 10, limitUnit: "GB" }, actorId)
    await publishPlan(plan.id, actorId)

    const detail = (await getPlan(plan.id)) as unknown as {
      status: string
      versions: Array<{ id: string; version: number; status: string; items: unknown[] }>
    }
    const v1 = detail.versions.find((v) => v.version === 1)!
    const v2row = detail.versions.find((v) => v.version === 2)!
    // V1 is superseded but intact (immutable history).
    expect(v1.status).toBe("ARCHIVED")
    expect(v2row.status).toBe("PUBLISHED")

    await archivePlan(plan.id, actorId)
    const after = (await getPlan(plan.id)) as unknown as { status: string; versions: unknown[] }
    expect(after.status).toBe("ARCHIVED")
    expect(after.versions).toHaveLength(2) // nothing deleted on archive
  })
})

afterAll(async () => {
  // Leave the archived verification plan in place as evidence; do not delete
  // (anything the catalog created is intentionally non-destructive). Just
  // disconnect the client.
  await db.$disconnect()
})
