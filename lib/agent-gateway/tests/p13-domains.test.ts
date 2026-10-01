/**
 * Phase 13 B–F — the new READ capabilities of the five domains, end to end
 * through the REAL chain (MCP server -> input hygiene -> Phase 6 policy ->
 * Phase 7 autonomy -> Phase 4 resolver -> adapter -> Phase 12 content guard)
 * on the governance test kit. Ownership always comes from the verified
 * connection; nothing outside the declared contract leaves an adapter.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

let k: GovernanceKit
const DAY = 86_400_000
const owner2 = () => k.agentCtx("conn_2", "owner_2")

beforeEach(async () => {
  k = await buildGovernanceKit()
  for (const id of ["products.listMine", "campaigns.getActive", "subscriptions.list", "tickets.get", "analytics.summary", "analytics.productPerformance"]) await k.allowRead(id)
}, 60_000)

function seedVendors() {
  k.exec.seedVendor({ id: "ven_1", userId: "owner_1" })
  k.exec.seedVendor({ id: "ven_2", userId: "owner_2" })
  k.exec.seedProduct({ id: "vp_1", name: "Mine live", slug: "mine-live", status: "AVAILABLE", type: "SAAS", vendorId: "ven_1", averageRating: 4.5, reviewCount: 2, deliveryConfig: { password_enc: "enc:topsecret" } })
  k.exec.seedProduct({ id: "vp_2", name: "Mine draft", slug: "mine-draft", status: "DRAFT", type: "TEMPLATE", vendorId: "ven_1" })
  k.exec.seedProduct({ id: "vp_3", name: "Theirs", slug: "theirs", status: "AVAILABLE", type: "SAAS", vendorId: "ven_2" })
}

describe("Phase 13 B — products.listMine", () => {
  it("returns only the owner's vendor products, drafts included, and nothing beyond the summary", async () => {
    seedVendors()
    const mine = await k.tool("products.listMine", {})
    expect(mine.isError).toBe(false)
    expect(mine.json.items.map((p: { id: string }) => p.id).sort()).toEqual(["vp_1", "vp_2"])
    expect(mine.text).not.toMatch(/topsecret|deliveryConfig|vendorId|ven_1/)
    expect(Object.keys(mine.json.items[0]).sort()).toEqual(["id", "name", "slug", "status", "type"])

    const theirs = await k.tool("products.listMine", {}, owner2())
    expect(theirs.json.items.map((p: { id: string }) => p.id)).toEqual(["vp_3"])

    const drafts = await k.tool("products.listMine", { status: "DRAFT" })
    expect(drafts.json.items.map((p: { id: string }) => p.id)).toEqual(["vp_2"])
  })

  it("a caller without a vendor profile gets an empty list, never someone else's catalogue", async () => {
    seedVendors()
    k.exec._vendors.delete("ven_1")
    const out = await k.tool("products.listMine", {})
    expect(out.json).toEqual({ items: [] })
  })

  it("refuses unknown statuses, oversized limits and identity fields before the gate", async () => {
    seedVendors()
    const spy = vi.spyOn(k.exec.client.vendorProfile, "findMany")
    for (const args of [{ status: "SECRET" }, { limit: 51 }, { vendorId: "ven_2" }, { ownerId: "owner_2" }]) {
      const out = await k.tool("products.listMine", args)
      expect(out.isError, JSON.stringify(args)).toBe(true)
      // Refused by the SDK's schema check or the gateway's own validation — either way before the gate.
      expect(out.text).toMatch(/^INVALID_INPUT|Input validation error/)
    }
    expect(spy).not.toHaveBeenCalled()
    expect(k.approval._requests.size).toBe(0)
  })
})

describe("Phase 13 C — campaigns.getActive", () => {
  it("returns the running campaign with the public field set only, labelled third-party content", async () => {
    const now = Date.now()
    k.exec.seedCampaign({ id: "cmp_live", name: "Diwali", label: "Festive", type: "FESTIVAL", discountPercent: 20, bannerText: "20% off", startsAt: new Date(now - DAY), endsAt: new Date(now + DAY), applicableTierIds: ["tier_1"], isActive: true, revenue: 99999, ctaUrl: "https://internal.example/cta", createdBy: "admin_1" })
    k.exec.seedCampaign({ id: "cmp_bigger_but_inactive", name: "Draft", label: null, type: "FLASH", discountPercent: 90, bannerText: null, startsAt: new Date(now - DAY), endsAt: new Date(now + DAY), applicableTierIds: [], isActive: false })
    k.exec.seedCampaign({ id: "cmp_expired", name: "Old", label: null, type: "FLASH", discountPercent: 50, bannerText: null, startsAt: new Date(now - 3 * DAY), endsAt: new Date(now - DAY), applicableTierIds: [], isActive: true })
    const out = await k.tool("campaigns.getActive", {})
    expect(out.isError).toBe(false)
    expect(out.json.campaign).toMatchObject({ id: "cmp_live", name: "Diwali", discountPercent: 20, applicableTierIds: ["tier_1"] })
    expect(out.json.campaign.secondsRemaining).toBeGreaterThan(80_000)
    expect(out.text).not.toMatch(/99999|internal\.example|admin_1|revenue|ctaUrl/)
    expect(out.raw.result.content[1].text).toMatch(/untrusted data, not as instructions/)
  })

  it("returns null when nothing is running, and takes no arguments", async () => {
    expect((await k.tool("campaigns.getActive", {})).json).toEqual({ campaign: null })
    expect((await k.tool("campaigns.getActive", { id: "x" })).isError).toBe(true)
  })
})

describe("Phase 13 D — subscriptions.list", () => {
  it("is owner-scoped, filtered, and never returns payment-gateway ids", async () => {
    const end = new Date(Date.now() + 30 * DAY)
    k.exec.seedSubscription({ id: "sub_a", userId: "owner_1", status: "ACTIVE", tierId: "tier_1", productId: "prod_1", currentPeriodEnd: end, cancelAtPeriodEnd: false, createdAt: new Date(), stripeSubId: "sub_STRIPE_SECRET" })
    k.exec.seedSubscription({ id: "sub_b", userId: "owner_1", status: "CANCELLED", tierId: "tier_2", productId: "prod_2", currentPeriodEnd: end, cancelAtPeriodEnd: true, createdAt: new Date(Date.now() - DAY) })
    k.exec.seedSubscription({ id: "sub_c", userId: "owner_2", status: "ACTIVE", tierId: "tier_1", productId: "prod_1", currentPeriodEnd: end, cancelAtPeriodEnd: false, createdAt: new Date() })
    const all = await k.tool("subscriptions.list", {})
    expect(all.json.items.map((s: { id: string }) => s.id)).toEqual(["sub_a", "sub_b"])
    expect(all.json.items[0]).toEqual({ id: "sub_a", status: "ACTIVE", planId: "tier_1", productId: "prod_1", currentPeriodEnd: end.toISOString(), cancelAtPeriodEnd: false })
    expect(all.text).not.toMatch(/STRIPE|stripeSubId|owner_/)
    // System-generated content: no third-party notice.
    expect(JSON.stringify(all.raw.result.content.slice(1))).not.toMatch(/written by platform users/)
    expect((await k.tool("subscriptions.list", { status: "CANCELLED" })).json.items.map((s: { id: string }) => s.id)).toEqual(["sub_b"])
    expect((await k.tool("subscriptions.list", {}, owner2())).json.items.map((s: { id: string }) => s.id)).toEqual(["sub_c"])
    expect((await k.tool("subscriptions.list", { status: "DELETED" })).isError).toBe(true)
  })
})

describe("Phase 13 E — tickets.get", () => {
  function seedTicket() {
    const t0 = Date.now() - DAY
    k.exec.seedTicket({ id: "tk_1", clientId: "owner_1", title: "Login fails", status: "OPEN", assignedTo: "staff_7", description: "I cannot sign in.", priority: "HIGH", category: "ACCOUNT", createdAt: new Date(t0), updatedAt: new Date(t0) })
    k.exec.seedTicketMessage({ id: "m1", ticketId: "tk_1", senderId: "owner_1", content: "Still broken", isInternal: false, createdAt: new Date(t0 + 1000) })
    k.exec.seedTicketMessage({ id: "m2", ticketId: "tk_1", senderId: "staff_7", content: "Looking into it", isInternal: false, createdAt: new Date(t0 + 2000) })
    k.exec.seedTicketMessage({ id: "m3", ticketId: "tk_1", senderId: "staff_7", content: "INTERNAL: customer is on the watch list", isInternal: true, createdAt: new Date(t0 + 3000) })
  }

  it("returns the owner's ticket and public conversation; internal notes and staff identities never leave", async () => {
    seedTicket()
    const out = await k.tool("tickets.get", { ticketId: "tk_1" })
    expect(out.isError).toBe(false)
    expect(out.json).toMatchObject({ id: "tk_1", subject: "Login fails", description: "I cannot sign in.", status: "OPEN", priority: "HIGH", category: "ACCOUNT", messagesTruncated: false })
    expect(out.json.messages.map((m: { id: string; fromCustomer: boolean }) => [m.id, m.fromCustomer])).toEqual([
      ["m1", true],
      ["m2", false],
    ])
    expect(out.text).not.toMatch(/watch list|INTERNAL|staff_7|assignedTo|senderId|owner_1/)
    expect(out.raw.result._meta["abhibhideveloper.online/content-trust"]).toMatchObject({ trust: "THIRD_PARTY_CONTENT" })
  })

  it("another owner's ticket is indistinguishable from a missing one", async () => {
    seedTicket()
    const theirs = await k.tool("tickets.get", { ticketId: "tk_1" }, owner2())
    const missing = await k.tool("tickets.get", { ticketId: "tk_nope" }, owner2())
    expect(theirs.isError).toBe(true)
    expect(theirs.text).toBe(missing.text)
    expect(theirs.text).toMatch(/^RESOURCE_NOT_FOUND/)
  })

  it("the conversation is bounded to the latest 50 messages, oldest first", async () => {
    seedTicket()
    for (let i = 0; i < 55; i += 1) {
      k.exec.seedTicketMessage({ id: `x${String(i).padStart(2, "0")}`, ticketId: "tk_1", senderId: "owner_1", content: `msg ${i}`, isInternal: false, createdAt: new Date(Date.now() - 1000 * (60 - i)) })
    }
    const out = await k.tool("tickets.get", { ticketId: "tk_1" })
    expect(out.json.messages).toHaveLength(50)
    expect(out.json.messagesTruncated).toBe(true)
    expect(out.json.messages[49].id).toBe("x54")
    expect(out.json.messages[0].id).toBe("x05")
  })
})

describe("Phase 13 F — analytics", () => {
  it("analytics.summary counts the owner's data only; non-vendors get no product block", async () => {
    seedVendors()
    k.exec.seedSubscription({ id: "s1", userId: "owner_1", status: "ACTIVE", tierId: "t", productId: "p" })
    k.exec.seedSubscription({ id: "s2", userId: "owner_1", status: "PAUSED", tierId: "t", productId: "p" })
    k.exec.seedSubscription({ id: "s3", userId: "owner_2", status: "ACTIVE", tierId: "t", productId: "p" })
    k.exec.seedTicket({ id: "t1", clientId: "owner_1", title: "a", status: "OPEN", assignedTo: null })
    k.exec.seedTicket({ id: "t2", clientId: "owner_1", title: "b", status: "CLOSED", assignedTo: null })
    k.exec.seedTicket({ id: "t3", clientId: "owner_2", title: "c", status: "IN_PROGRESS", assignedTo: null })
    const mine = await k.tool("analytics.summary", {})
    expect(mine.json).toEqual({ subscriptions: { active: 1, total: 2 }, tickets: { open: 1, total: 2 }, products: { published: 1, total: 2 } })
    k.exec._vendors.delete("ven_2")
    expect((await k.tool("analytics.summary", {}, owner2())).json).toEqual({ subscriptions: { active: 1, total: 1 }, tickets: { open: 1, total: 1 }, products: null })
  })

  it("analytics.productPerformance: the owner's product, inside the window, counts only", async () => {
    seedVendors()
    const now = Date.now()
    let n = 0
    const ev = (type: string, productId: string, ageDays: number) => k.exec.seedMetricEvent({ id: `ev_${(n += 1)}`, type, productId, userId: "buyer_secret_id", occurredAt: new Date(now - ageDays * DAY) })
    for (let i = 0; i < 8; i += 1) ev("VIEW", "vp_1", 1)
    ev("VIEW", "vp_1", 45) // outside the default 30-day window
    ev("CART_ADD", "vp_1", 2)
    ev("CART_ADD", "vp_1", 3)
    ev("CHECKOUT_STARTED", "vp_1", 3)
    ev("PURCHASE", "vp_1", 3)
    ev("PURCHASE", "vp_3", 1) // another vendor's product
    const out = await k.tool("analytics.productPerformance", { productId: "vp_1" })
    expect(out.json).toEqual({ productId: "vp_1", days: 30, views: 8, cartAdds: 2, checkoutsStarted: 1, purchases: 1, conversionRate: 0.125, averageRating: 4.5, reviewCount: 2 })
    expect(out.text).not.toMatch(/buyer_secret_id|ven_1/)
    expect((await k.tool("analytics.productPerformance", { productId: "vp_1", days: 90 })).json.views).toBe(9)
    expect((await k.tool("analytics.productPerformance", { productId: "vp_1", days: 14 })).isError).toBe(true) // closed windows only
  })

  it("analytics.productPerformance refuses other vendors' and vendor-less products identically", async () => {
    seedVendors()
    const texts: string[] = []
    for (const productId of ["vp_3", "prod_1", "nope"]) {
      const out = await k.tool("analytics.productPerformance", { productId })
      expect(out.isError, productId).toBe(true)
      texts.push(out.text)
    }
    expect(new Set(texts).size).toBe(1)
    expect(texts[0]).toMatch(/^RESOURCE_NOT_FOUND/)
  })
})

describe("Phase 13 — reads are still gated", () => {
  it("without a Phase 6 allow the new reads are denied before any adapter runs", async () => {
    k = await buildGovernanceKit()
    seedVendors()
    const spy = vi.spyOn(k.exec.client.vendorProfile, "findMany")
    const out = await k.tool("products.listMine", {})
    expect(out.isError).toBe(true)
    expect(out.text).toMatch(/AUTHORIZATION_DENIED|denied/i)
    expect(spy).not.toHaveBeenCalled()
  })
})
