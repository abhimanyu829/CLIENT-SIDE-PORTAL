import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  accepted: vi.fn(),
  record: vi.fn(async () => ({})),
  cookieUpsert: vi.fn(async () => ({})),
  productFindMany: vi.fn(async () => []),
  productCount: vi.fn(async () => 0),
  userFindUnique: vi.fn(async () => null),
  entitlementFindFirst: vi.fn(async () => null),
  stockFindUnique: vi.fn(async () => null),
  subscriptionFindFirst: vi.fn(async () => null),
  getServiceDiscovery: vi.fn(async () => ({ placements: [] })),
}))

vi.mock("@/lib/auth", () => ({ auth: h.auth }))
vi.mock("@/lib/db", () => ({
  db: {
    cookiePreference: { upsert: h.cookieUpsert },
    product: { findMany: h.productFindMany, count: h.productCount },
    user: { findUnique: h.userFindUnique },
    customerEntitlement: { findFirst: h.entitlementFindFirst },
    productStock: { findUnique: h.stockFindUnique },
    subscription: { findFirst: h.subscriptionFindFirst },
  },
}))
vi.mock("@/lib/legal-consent", () => ({
  hasAcceptedCurrentLegal: h.accepted,
  recordLegalConsent: h.record,
  CURRENT_TERMS_VERSION: "terms-test-1",
  CURRENT_PRIVACY_VERSION: "privacy-test-1",
  COOKIE_PREF_VERSION: "v1",
  isSafeReturnUrl: (v: unknown) =>
    typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : null,
}))
vi.mock("@/lib/sanitize-product", () => ({
  sanitizeProductsForPublic: (p: unknown) => p,
  sanitizeProductForPublic: (p: unknown) => p,
}))
vi.mock("@/lib/service-discovery", () => ({ getServiceDiscovery: h.getServiceDiscovery }))
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))
vi.mock("@/lib/api-auth", () => ({
  requireApiAuth: vi.fn(async () => "user_cart"),
  UnauthorizedError: class UnauthorizedError extends Error {},
}))

import { POST as acceptPOST } from "@/app/api/legal/accept/route"
import { GET as statusGET } from "@/app/api/legal/status/route"
import { GET as cookieGET, POST as cookiePOST } from "@/app/api/cookie-prefs/route"
import { GET as productsGET } from "@/app/api/products/route"
import { GET as discoveryGET } from "@/app/api/service-discovery/route"
import { POST as validatePOST } from "@/app/api/products/validate-purchase/route"
import { POST as cartValidatePOST } from "@/app/api/cart/validate/route"

function asAnon() {
  h.auth.mockResolvedValue(null)
}
function asUser(id = "user_1") {
  h.auth.mockResolvedValue({ user: { id } })
}
function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  asAnon()
  h.accepted.mockResolvedValue(true)
  h.record.mockResolvedValue({})
  h.cookieUpsert.mockResolvedValue({})
})

describe("/api/legal/accept", () => {
  it("rejects unauthenticated callers", async () => {
    const res = await acceptPOST(jsonRequest("http://x/api/legal/accept", { accepted: true }))
    expect(res.status).toBe(401)
    expect(h.record).not.toHaveBeenCalled()
  })

  it("rejects a request without explicit acceptance", async () => {
    asUser()
    const res = await acceptPOST(jsonRequest("http://x/api/legal/accept", { accepted: false }))
    expect(res.status).toBe(400)
    expect(h.record).not.toHaveBeenCalled()
  })

  it("records acceptance bound to the session user, never trusting a client id", async () => {
    asUser("user_9")
    const res = await acceptPOST(jsonRequest("http://x/api/legal/accept", { accepted: true, userId: "attacker" }))
    expect(res.status).toBe(200)
    expect(h.record).toHaveBeenCalledTimes(1)
    expect((h.record.mock.calls[0] as unknown[])[0]).toBe("user_9")
  })
})

describe("/api/legal/status", () => {
  it("rejects unauthenticated callers", async () => {
    expect((await statusGET()).status).toBe(401)
  })

  it("reports the current versions and acceptance state", async () => {
    asUser()
    h.accepted.mockResolvedValueOnce(true)
    const res = await statusGET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      accepted: true,
      termsVersion: "terms-test-1",
      privacyVersion: "privacy-test-1",
    })
  })
})

describe("/api/cookie-prefs", () => {
  it("returns the stored preference cookie value", async () => {
    const res = await cookieGET(
      new Request("http://x/api/cookie-prefs", { headers: { cookie: "cookie_prefs=abc" } })
    )
    expect((await res.json()).cookie).toBe("abc")
  })

  it("persists the choice and sets the cookie", async () => {
    asUser("user_c")
    const res = await cookiePOST(
      jsonRequest("http://x/api/cookie-prefs", { analytics: true, marketing: false })
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("set-cookie") ?? "").toContain("cookie_prefs=")
    expect(h.cookieUpsert).toHaveBeenCalledTimes(1)
  })
})

describe("marketplace API gate", () => {
  it("/api/products rejects unauthenticated callers with 401", async () => {
    const res = await productsGET(new Request("http://x/api/products"))
    expect(res.status).toBe(401)
  })

  it("/api/products rejects authenticated-but-unconsented callers with 403", async () => {
    asUser("user_no_consent")
    h.accepted.mockResolvedValueOnce(false)
    const res = await productsGET(new Request("http://x/api/products"))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe("CONSENT_REQUIRED")
  })

  it("/api/products allows authenticated + consented callers", async () => {
    asUser("user_ok")
    h.accepted.mockResolvedValueOnce(true)
    const res = await productsGET(new Request("http://x/api/products"))
    expect(res.status).toBe(200)
  })

  it("/api/service-discovery rejects unauthenticated and unconsented callers", async () => {
    expect((await discoveryGET(new NextRequest("http://x/api/service-discovery"))).status).toBe(401)
    asUser("user_sd")
    h.accepted.mockResolvedValueOnce(false)
    expect((await discoveryGET(new NextRequest("http://x/api/service-discovery"))).status).toBe(403)
  })

  it("/api/products/validate-purchase rejects unauthenticated and unconsented callers", async () => {
    const url = "http://x/api/products/validate-purchase"
    expect((await validatePOST(new NextRequest(url, { method: "POST", body: JSON.stringify({ productId: "p1" }) }))).status).toBe(401)
    asUser("user_vp")
    h.accepted.mockResolvedValueOnce(false)
    const res = await validatePOST(
      new NextRequest(url, { method: "POST", body: JSON.stringify({ productId: "p1" }) })
    )
    expect(res.status).toBe(403)
    expect((await res.json()).reasons).toContain("CONSENT_REQUIRED")
  })

  it("/api/cart/validate rejects unconsented callers", async () => {
    asUser("user_cart")
    h.accepted.mockResolvedValueOnce(false)
    const res = await cartValidatePOST(
      new NextRequest("http://x/api/cart/validate", { method: "POST", body: "{}" })
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe("CONSENT_REQUIRED")
  })
})
