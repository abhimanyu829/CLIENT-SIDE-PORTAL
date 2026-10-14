import { describe, it, expect, vi, beforeEach } from "vitest"

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: { legalConsent: { findUnique: h.findUnique, upsert: h.upsert } },
}))

import {
  isSafeReturnUrl,
  hasAcceptedCurrentLegal,
  recordLegalConsent,
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from "@/lib/legal-consent"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("isSafeReturnUrl (open-redirect prevention)", () => {
  it("accepts safe internal destinations", () => {
    expect(isSafeReturnUrl("/marketplace")).toBe("/marketplace")
    expect(isSafeReturnUrl("/services/slug?x=1")).toBe("/services/slug?x=1")
    expect(isSafeReturnUrl("/a/b#c")).toBe("/a/b#c")
  })

  it("rejects external, protocol-relative and scheme URLs", () => {
    expect(isSafeReturnUrl("https://evil.com")).toBeNull()
    expect(isSafeReturnUrl("//evil.com")).toBeNull()
    expect(isSafeReturnUrl("javascript:alert(1)")).toBeNull()
    expect(isSafeReturnUrl("/\\evil")).toBeNull()
    expect(isSafeReturnUrl("https://abhibhideveloper.tech")).toBeNull()
  })

  it("rejects empty/absent values", () => {
    expect(isSafeReturnUrl("")).toBeNull()
    expect(isSafeReturnUrl(null)).toBeNull()
    expect(isSafeReturnUrl(undefined)).toBeNull()
  })
})

describe("hasAcceptedCurrentLegal (server-side version check)", () => {
  it("returns true only when both stored versions match the current ones", async () => {
    h.findUnique.mockResolvedValueOnce({
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
    })
    expect(await hasAcceptedCurrentLegal("user_1")).toBe(true)
    expect(h.findUnique).toHaveBeenCalledWith({ where: { userId: "user_1" } })
  })

  it("returns false when a stored version is outdated", async () => {
    h.findUnique.mockResolvedValueOnce({
      termsVersion: "2020-01-01-v1",
      privacyVersion: CURRENT_PRIVACY_VERSION,
    })
    expect(await hasAcceptedCurrentLegal("user_1")).toBe(false)
  })

  it("returns false when no consent record exists", async () => {
    h.findUnique.mockResolvedValueOnce(null)
    expect(await hasAcceptedCurrentLegal("user_1")).toBe(false)
  })

  it("fails closed when the read throws", async () => {
    h.findUnique.mockRejectedValueOnce(new Error("db down"))
    expect(await hasAcceptedCurrentLegal("user_1")).toBe(false)
  })
})

describe("recordLegalConsent", () => {
  it("upserts the current versions bound to the user identity", async () => {
    h.upsert.mockResolvedValueOnce({ id: "consent_1" })

    await recordLegalConsent("user_42", { ip: "203.0.113.7", userAgent: "vitest" })

    expect(h.upsert).toHaveBeenCalledTimes(1)
    const arg = h.upsert.mock.calls[0][0] as {
      where: { userId: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }
    expect(arg.where).toEqual({ userId: "user_42" })
    expect(arg.create).toMatchObject({
      userId: "user_42",
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      ip: "203.0.113.7",
      userAgent: "vitest",
    })
    expect(arg.update).toMatchObject({
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
    })
  })
})
