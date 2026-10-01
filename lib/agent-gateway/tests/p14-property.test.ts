/**
 * Phase 14 E — property tests of the security primitives, driven by the
 * seeded PRNG (no extra dependency). Each property is checked over
 * hundreds of generated inputs; a failure message carries the seed and
 * iteration so it can be replayed.
 */
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { deepValue, hostileValue, int, mulberry32, pick, type Rng } from "../simulation/fuzzer"
import { containsSecret, scrubSecrets } from "../security/secret-patterns"
import { inspectAgentInput } from "../security/input-hygiene"
import { detectInText, detectInjection } from "../security/injection-detector"
import { guardAgentOutput } from "../security/content-guard"
import { checkOutboundUrl } from "../security/outbound-guard"
import { canonicalJson } from "../approvals/canonical-json"
import { computeInputDigest } from "../approvals/binding"
import { idempotencyKeyFromMeta, IDEMPOTENCY_META_KEY } from "../mcp/request-meta"
import { captureRecoveryInput } from "../recovery/spec"

const N = 400
const SAFE_ALPHABET = "abcdefghijklmnopqrstuvwxyz ABCDEFGHIJ0123456789.,-_"
const safeText = (rng: Rng, max = 60) => Array.from({ length: int(rng, 0, max) }, () => pick(rng, SAFE_ALPHABET.split(""))).join("")
const SECRETS = [`agw_${"ab12".repeat(8)}`, "sk_live_" + "Q".repeat(20), `whsec_${"k".repeat(16)}`, `AKIA${"A".repeat(16)}`, `ghp_${"x".repeat(30)}`, "f".repeat(64), "postgres://u:pw@db.internal/x"]

function shuffleKeys(value: unknown, rng: Rng): unknown {
  if (Array.isArray(value)) return value.map((v) => shuffleKeys(v, rng))
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(() => rng() - 0.5)
    return Object.fromEntries(entries.map(([k, v]) => [k, shuffleKeys(v, rng)]))
  }
  return value
}

describe("Phase 14 E — secret scrubbing", () => {
  it("removes every planted secret, is idempotent, and never changes secret-free text", () => {
    const rng = mulberry32(101)
    for (let i = 0; i < N; i += 1) {
      const plain = safeText(rng)
      expect(scrubSecrets(plain).value, `i=${i}`).toBe(plain)
      const planted = `${safeText(rng, 20)} ${pick(rng, SECRETS)} ${safeText(rng, 20)}`
      const once = scrubSecrets(planted).value
      expect(containsSecret(once), `i=${i}`).toBe(false)
      expect(scrubSecrets(once).value, `idempotent i=${i}`).toBe(once)
    }
  })
})

describe("Phase 14 E — input hygiene", () => {
  it("never throws, and anything it accepts is shallow, small and JSON-serialisable", () => {
    const rng = mulberry32(202)
    for (let i = 0; i < N; i += 1) {
      const value = rng() < 0.1 ? deepValue(int(rng, 1, 30)) : { a: hostileValue(rng), b: hostileValue(rng) }
      const verdict = inspectAgentInput(value)
      if (verdict.ok) {
        expect(() => JSON.stringify(value), `i=${i}`).not.toThrow()
        expect(JSON.stringify(value) ?? "").not.toMatch(/[\u202A-\u202E\u2066-\u2069]|\\u0000/)
      } else {
        expect(verdict.reason, `i=${i}`).toMatch(/^[A-Z_]+$/)
      }
    }
  })
})

describe("Phase 14 E — canonical binding", () => {
  it("the input digest is independent of key order and changes with any value", () => {
    const rng = mulberry32(303)
    for (let i = 0; i < N; i += 1) {
      const value = { x: safeText(rng), n: int(rng, 0, 1000), nested: { a: safeText(rng), b: [int(rng, 0, 9), safeText(rng)] }, flag: rng() < 0.5 }
      const shuffled = shuffleKeys(value, rng)
      expect(canonicalJson(shuffled), `i=${i}`).toBe(canonicalJson(value))
      expect(computeInputDigest(shuffled)).toBe(computeInputDigest(value))
      expect(computeInputDigest({ ...value, n: value.n + 1 })).not.toBe(computeInputDigest(value))
    }
  })
})

describe("Phase 14 E — content guard", () => {
  const schema = z.object({ items: z.array(z.object({ id: z.string(), title: z.string() }).strict()).max(50) }).strict()

  it("either returns schema-valid, secret-free output or withholds it; never throws", () => {
    const rng = mulberry32(404)
    for (let i = 0; i < N; i += 1) {
      const items = Array.from({ length: int(rng, 0, 8) }, () => ({ id: safeText(rng, 12), title: rng() < 0.3 ? `${safeText(rng, 10)} ${pick(rng, SECRETS)}` : String(hostileValue(rng) ?? "") }))
      const out = guardAgentOutput({ outputSchema: schema, contentTrust: "THIRD_PARTY_CONTENT" }, { items })
      if (out.ok) {
        expect(schema.safeParse(out.output).success, `i=${i}`).toBe(true)
        expect(containsSecret(JSON.stringify(out.output)), `i=${i}`).toBe(false)
        expect(out.findings.trust).toBe("THIRD_PARTY_CONTENT")
      } else {
        expect(["REDACTION_FAILED", "REDACTED_OUTPUT_INVALID", "OUTPUT_TOO_LARGE", "NOT_SERIALIZABLE"]).toContain(out.reason)
      }
    }
  })
})

describe("Phase 14 E — injection detector", () => {
  it("is total and bounded: any input, any size, returns known signals quickly", () => {
    const rng = mulberry32(505)
    for (let i = 0; i < 60; i += 1) {
      const text = Array.from({ length: int(rng, 1, 400) }, () => String(hostileValue(rng) ?? "")).join(" ")
      const started = performance.now()
      const signals = detectInText(text)
      expect(performance.now() - started, `i=${i}`).toBeLessThan(250)
      for (const s of signals) expect(s).toMatch(/^[A-Z_]+$/)
      expect(() => detectInjection({ a: [text, { b: text }] })).not.toThrow()
    }
  })
})

describe("Phase 14 E — outbound guard", () => {
  it("refuses every private / loopback / metadata IP literal and every host off the allowlist", () => {
    const rng = mulberry32(606)
    const policy = { allowedHosts: ["api.partner.example"] }
    for (let i = 0; i < N; i += 1) {
      const ip = pick(rng, [`10.${int(rng, 0, 255)}.${int(rng, 0, 255)}.${int(rng, 0, 255)}`, `127.0.0.${int(rng, 1, 254)}`, "169.254.169.254", `192.168.${int(rng, 0, 255)}.1`, "[::1]", "0x7f000001", "2130706433"])
      expect(checkOutboundUrl(`https://${ip}/x`, policy).ok, ip).toBe(false)
      const host = `${safeText(rng, 8).replace(/[^a-z]/g, "") || "h"}.example`
      if (host !== "api.partner.example") expect(checkOutboundUrl(`https://${host}/`, policy).ok, host).toBe(false)
    }
    expect(checkOutboundUrl("https://api.partner.example/v1", policy).ok).toBe(true)
  })
})

describe("Phase 14 E — idempotency keys and recovery identifiers", () => {
  it("a _meta key is accepted iff it has the documented shape and no reserved prefix", () => {
    const rng = mulberry32(707)
    for (let i = 0; i < N; i += 1) {
      const key = rng() < 0.5 ? `${pick(rng, ["", "trigger.", "recovery.", "a-"])}${safeText(rng, 140)}` : hostileValue(rng)
      const parsed = idempotencyKeyFromMeta({ [IDEMPOTENCY_META_KEY]: key })
      const valid = typeof key === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(key) && !key.startsWith("trigger.") && !key.startsWith("recovery.")
      if (key === undefined) expect(parsed).toEqual({ ok: true, key: undefined })
      else expect(parsed.ok, `i=${i} ${JSON.stringify(key)}`).toBe(valid)
    }
  })

  it("captured recovery input is only ever the mapped top-level primitives", () => {
    const rng = mulberry32(808)
    const spec = { class: "COMPENSATABLE" as const, capabilityId: "tickets.close", capabilityVersion: 1, inputMapping: { ticketId: "output.id" }, manualRecoveryRequired: false, recommendation: "x" }
    for (let i = 0; i < N; i += 1) {
      const output = { id: hostileValue(rng), other: hostileValue(rng) }
      const captured = captureRecoveryInput(spec, {}, output)
      if (captured === null) continue
      expect(Object.keys(captured)).toEqual(["ticketId"])
      expect(["string", "number", "boolean"]).toContain(typeof captured.ticketId)
    }
  })
})
