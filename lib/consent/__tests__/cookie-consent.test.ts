import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/legal-consent", () => ({
  COOKIE_PREF_VERSION: "v1",
  CURRENT_TERMS_VERSION: "terms",
  CURRENT_PRIVACY_VERSION: "privacy",
  hasAcceptedCurrentLegal: vi.fn(),
  recordLegalConsent: vi.fn(),
  isSafeReturnUrl: vi.fn(),
}))

import { parseCookiePrefs, serializeCookiePrefs, DEFAULT_COOKIE_PREFS, COOKIE_NAME } from "@/lib/cookie-consent"

describe("cookie preferences", () => {
  it("round-trips through serialize -> parse", () => {
    const prefs = { essential: true as const, analytics: true, marketing: false }
    expect(parseCookiePrefs(serializeCookiePrefs(prefs))).toEqual({
      essential: true,
      analytics: true,
      marketing: false,
    })
  })

  it("always reports essential as enabled", () => {
    const parsed = parseCookiePrefs(serializeCookiePrefs({ essential: true, analytics: false, marketing: false }))
    expect(parsed?.essential).toBe(true)
  })

  it("rejects a stored value from a different version", () => {
    const stale = encodeURIComponent(JSON.stringify({ v: "v0", a: 1, m: 1 }))
    expect(parseCookiePrefs(stale)).toBeNull()
  })

  it("rejects malformed or absent values", () => {
    expect(parseCookiePrefs("not-json")).toBeNull()
    expect(parseCookiePrefs(null)).toBeNull()
    expect(parseCookiePrefs(undefined)).toBeNull()
  })

  it("defaults optional cookies off and essential on", () => {
    expect(DEFAULT_COOKIE_PREFS).toEqual({ essential: true, analytics: false, marketing: false })
    expect(COOKIE_NAME).toBe("cookie_prefs")
  })
})
