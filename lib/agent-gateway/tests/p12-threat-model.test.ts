/**
 * Phase 12 A — the threat model cannot drift from the implementation.
 *
 * TRUST_BOUNDARIES (security/trust-boundaries.ts) is the machine-readable
 * threat model. This suite proves that every boundary names threats and
 * controls, that every enforcing module and proving test it cites exists,
 * and that the human-readable documents cover every boundary.
 */
import { existsSync, readFileSync } from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { TRUST_BOUNDARIES } from "../security/trust-boundaries"

const DOCS = path.resolve("docs/agent-gateway/phase-12")

describe("Phase 12 A — trust boundaries as code", () => {
  it("has unique, sequential boundary ids", () => {
    const ids = TRUST_BOUNDARIES.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(ids.map((_, i) => `TB${i + 1}`))
    expect(ids.length).toBeGreaterThanOrEqual(10)
  })

  it("every boundary names its parties, at least one threat, one control, one enforcing module and one proving test", () => {
    for (const b of TRUST_BOUNDARIES) {
      expect(b.from.trim(), b.id).not.toBe("")
      expect(b.to.trim(), b.id).not.toBe("")
      expect(b.threats.length, b.id).toBeGreaterThan(0)
      expect(b.controls.length, b.id).toBeGreaterThan(0)
      expect(b.enforcedBy.length, b.id).toBeGreaterThan(0)
      expect(b.provenBy.length, b.id).toBeGreaterThan(0)
    }
  })

  it("every enforcing module exists inside the gateway", () => {
    const missing = TRUST_BOUNDARIES.flatMap((b) => b.enforcedBy.filter((p) => !p.startsWith("lib/agent-gateway/") || !existsSync(path.resolve(p))).map((p) => `${b.id}: ${p}`))
    expect(missing).toEqual([])
  })

  it("every proving test exists and is a test file", () => {
    const missing = TRUST_BOUNDARIES.flatMap((b) => b.provenBy.filter((p) => !/\.test\.ts$/.test(p) || !existsSync(path.resolve(p))).map((p) => `${b.id}: ${p}`))
    expect(missing).toEqual([])
  })

  it("untrusted boundaries are never enforced only by prose: each cites a code control and a test", () => {
    for (const b of TRUST_BOUNDARIES.filter((x) => x.dataTrust === "UNTRUSTED" || x.dataTrust === "AUTHENTICATED_UNTRUSTED")) {
      expect(b.enforcedBy.some((p) => p.endsWith(".ts") && !p.endsWith(".test.ts")), b.id).toBe(true)
      expect(b.provenBy.length, b.id).toBeGreaterThan(0)
    }
  })

  it("the threat model and trust-boundary documents cover every boundary", () => {
    const threat = readFileSync(path.join(DOCS, "01-threat-model.md"), "utf8")
    const boundaries = readFileSync(path.join(DOCS, "02-trust-boundaries.md"), "utf8")
    for (const b of TRUST_BOUNDARIES) {
      expect(boundaries.includes(`${b.id} `) || boundaries.includes(`${b.id}:`) || boundaries.includes(`${b.id} |`) || boundaries.includes(`| ${b.id}`), `02 mentions ${b.id}`).toBe(true)
      expect(threat.includes(b.id), `01 mentions ${b.id}`).toBe(true)
    }
  })
})
