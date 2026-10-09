/**
 * Phase 4 — LIVE Razorpay TEST-MODE round-trip (opt-in).
 *
 * Skipped by default. Requires TEST-MODE merchants keys (rzp_test_) in .env.
 * NEVER run against live keys — the key prefix is asserted before any call.
 *
 * Run: $env:LIVE_RZP="1"; npm run test:razorpay -- razorpay-live-db
 *
 * What actually runs (real provider, sandbox, no real money):
 *   publish a verify plan (Phase-2 service)
 *   → ensureRazorpayPlanMapping → REAL plans.create (plan_test_…)
 *   → createRecurringSubscription → REAL subscriptions.create (sub_test_…)
 *   → genuine HMAC webhook payload signed with the configured secret
 *     → handleSubscriptionWebhook (activated) → internal ACTIVE
 *   → simulated-but-real-recorded charge event → SubscriptionCharge
 *
 * NOTE: automatic delivery from the Razorpay dashboard webhook cannot be
 * triggered from a CLI; the dashboard endpoint configuration
 * (/api/webhooks/razorpay/subscriptions) remains a manual merchant step.
 */
import { afterAll, describe, expect, it } from "vitest"
import crypto from "crypto"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { createPlan, addPlanItem, publishPlan, updateDraftVersion } from "@/lib/services/plan-catalog-service"
import { ensureRazorpayPlanMapping, createRecurringSubscription, subscriptionWebhookSecret } from "@/lib/services/razorpay-billing"
import { handleSubscriptionWebhook } from "@/lib/services/razorpay-subscription-webhook"
import { SubscriptionStatus } from "@prisma/client"

const LIVE = process.env.LIVE_RZP === "1"
const suite = LIVE ? describe : describe.skip

suite("live Razorpay TEST-MODE round-trip", () => {
  it("safe-guards the environment before any provider call", () => {
    expect(env.RAZORPAY_KEY_ID).toMatch(/^rzp_test_/)
  })

  it("publishes a verify plan → real Razorpay plan → real Razorpay subscription → webhook activates", async () => {
    const keyId = env.RAZORPAY_KEY_ID ?? ""
    if (!keyId.startsWith("rzp_test_")) {
      throw new Error("REFUSING: RAZORPAY_KEY_ID is not TEST-MODE (rzp_test_)")
    }
    const actor = await db.user.findFirst({ where: { isBanned: false }, select: { id: true } })
    if (!actor) {
      console.warn("live rzp verify skipped: no usable User row")
      return
    }

    // 1) Fresh published plan version through the Phase-2 catalog service.
    const stub = await createPlan(
      { name: `Verify RZP ${Date.now()}`, slug: `verify-rzp-${Date.now()}`, planType: "MONTHLY", currency: "INR", basePrice: 100 },
      actor.id,
    )
    // Billing contract: the mapper refuses to GUESS a billing interval, so the
    // verify plan declares 1-month billing explicitly (indefinite term).
    await updateDraftVersion(stub.version.id, { billingIntervalMonths: 1 }, actor.id)
    await addPlanItem(stub.version.id, { itemType: "STORAGE", limitValue: 1, limitUnit: "GB" }, actor.id)
    const published = await publishPlan(stub.plan.id, actor.id)

    // 2) REAL Razorpay TEST plan creation + persisted mapping.
    const mapping = await ensureRazorpayPlanMapping(published.version.id, actor.id)
    expect(mapping.razorpayPlanId).toMatch(/^plan_test_/)
    expect(mapping.amountSubunits).toBe(10000) // ₹100 = 10000 paise
    const mappingRow = await db.razorpayPlanMapping.findUnique({
      where: { planVersionId_environment: { planVersionId: published.version.id, environment: mapping.environment } },
    })
    expect(mappingRow?.razorpayPlanId).toBe(mapping.razorpayPlanId)

    // 3) REAL Razorpay TEST subscription creation (no charge happens until
    //    the customer authenticates through checkout).
    const created = await createRecurringSubscription({ planVersionId: published.version.id }, actor.id)
    expect(created.razorpaySubscriptionId).toMatch(/^sub_test_/)
    const usub = await db.userSubscription.findUnique({ where: { id: created.internalSubscriptionId } })
    expect(usub?.razorpaySubscriptionId).toBe(created.razorpaySubscriptionId)
    expect(usub?.status).toBe(SubscriptionStatus.TRIALING)

    // 4) Genuine webhook delivery simulation: payload signed with the actual
    //    configured subscriptions webhook secret (HMAC over exact raw bytes).
    const secret = subscriptionWebhookSecret()
    if (!secret) throw new Error("no subscription webhook secret configured")
    const payload = JSON.stringify({
      entity: "event",
      id: `ev_live_${Date.now()}`,
      event: "subscription.activated",
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        subscription: {
          entity: {
            id: created.razorpaySubscriptionId,
            status: "active",
            current_start: Math.floor(Date.now() / 1000) - 86400,
            current_end: Math.floor(Date.now() / 1000) + 2_592_000,
          },
        },
      },
    })
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex")
    const result = await handleSubscriptionWebhook(payload, signature, secret)
    expect(result.processed).toBe(true)
    const afterActivate = await db.userSubscription.findUnique({ where: { id: created.internalSubscriptionId } })
    expect(afterActivate?.status).toBe(SubscriptionStatus.ACTIVE)

    // 5) Charge event (simulated payment entity — TEST checkout was never
    //    completed by a customer; record is transparently marked).
    const chargePayload = JSON.stringify({
      entity: "event",
      id: `ev_live_charge_${Date.now()}`,
      event: "subscription.charged",
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        subscription: { entity: { id: created.razorpaySubscriptionId, status: "active" } },
        payment: { entity: { id: `pay_live_sim_${Date.now()}`, status: "captured", amount: 10000, currency: "INR" } },
      },
    })
    const chargeSig = crypto.createHmac("sha256", secret).update(chargePayload).digest("hex")
    const chargeResult = await handleSubscriptionWebhook(chargePayload, chargeSig, secret)
    expect(chargeResult.processed).toBe(true)
    const charge = await db.subscriptionCharge.findFirst({
      where: { subscriptionId: created.internalSubscriptionId },
    })
    expect(charge).not.toBeNull()
    expect(charge!.amountSubunits).toBe(10000)
    expect(charge!.chargeStatus).toBe("SUCCEEDED")

    // Evidence retained (non-destructive): plan stays published, mapping and
    // subscription and charge rows persist for inspection.
  })
})

afterAll(async () => {
  await db.$disconnect()
})
