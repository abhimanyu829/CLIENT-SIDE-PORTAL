/**
 * Phase 7 — Section G (Cua contract, failure handling, anti-bypass) and
 * Section H (escalation resistance: structural proof that no agent-reachable
 * path can decide approvals or write autonomy policy).
 */
import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "fs"
import path from "path"
import {
  APPROVAL_SURFACE_TITLE,
  cuaObservationCanGrantApproval,
  describeApprovalSurface,
  evaluateObservationAgainstSurface,
  parseCuaHealthReport,
  toCuaRuntimeSignal,
  type CuaEnvironmentStatus,
} from "../human-in-the-loop/cua-contract"

// Verbatim shape of the installed cua-driver 0.30.4 health_report (Step 0 audit).
// Captured live from the installed driver's health_report tool during Phase 7 verification.
const HEALTHY = [
  "✅ cua-driver 0.30.4 on win32 — ok",
  "  ✅ binary_version: cua-driver 0.30.4",
  "  ✅ platform_supported: Windows Microsoft Windows [Version 10.0.26200.9550] (x86_64)",
  "  ✅ session_active: MCP session is active.",
  "  ⏭ bundle_identity: not applicable on Windows",
  "  ⏭ tcc_accessibility: not applicable on Windows",
  "  ⏭ tcc_screen_recording: not applicable on Windows",
  "  ✅ ax_capability: UIAutomation is reachable; UI tree walking will succeed.",
  "  ✅ screen_capture_capability: D3D11 device reachable; Windows Graphics Capture will succeed.",
].join("\n")

describe("Section G — Cua trust boundary", () => {
  it("no Cua observation can ever grant an approval — including one that 'saw' Approved", () => {
    const statuses: CuaEnvironmentStatus[] = ["READY", "NOT_READY", "PERMISSION_DENIED", "TARGET_NOT_FOUND", "UNEXPECTED_STATE", "TIMEOUT", "INTERRUPTED"]
    for (const status of statuses) {
      expect(cuaObservationCanGrantApproval({ status, observedReference: "apr_x", detail: "Approved ✓" })).toBe(false)
    }
  })

  it("describes the existing admin approval surface for a request", () => {
    const s = describeApprovalSurface("apr_" + "1".repeat(32))
    expect(s.path).toBe(`/admin/agent-approvals/apr_${"1".repeat(32)}`)
    expect(s.expectedReference).toBe("apr_" + "1".repeat(32))
    expect(s.expectedTitleFragment).toBe(APPROVAL_SURFACE_TITLE)
  })

  it("surface path cannot be redirected by a crafted reference", () => {
    expect(describeApprovalSurface("../../api/x?y").path).toBe("/admin/agent-approvals/..%2F..%2Fapi%2Fx%3Fy")
  })

  it("a wrong / stale / missing on-screen reference is CUA_STATE_MISMATCH, never a decision", () => {
    const surface = describeApprovalSurface("apr_a")
    expect(evaluateObservationAgainstSurface({ status: "READY", observedReference: "apr_b" }, surface)).toEqual({ status: "UNEXPECTED_STATE", signal: "CUA_STATE_MISMATCH" })
    expect(evaluateObservationAgainstSurface({ status: "READY" }, surface).signal).toBe("CUA_STATE_MISMATCH")
    expect(evaluateObservationAgainstSurface({ status: "READY", observedReference: "apr_a" }, surface)).toEqual({ status: "READY", signal: null })
  })

  it("Cua failures map to environment signals, disjoint from security decision codes", () => {
    const security = new Set(["AUTHORIZATION_DENIED", "APPROVAL_REJECTED", "APPROVAL_REQUIRED", "POLICY_DENY", "AUTONOMY_DENIED"])
    const map: Record<CuaEnvironmentStatus, string | null> = {
      READY: null,
      NOT_READY: "CUA_DESKTOP_UNAVAILABLE",
      PERMISSION_DENIED: "CUA_PERMISSION_DENIED",
      TARGET_NOT_FOUND: "CUA_TARGET_APPLICATION_MISSING",
      UNEXPECTED_STATE: "CUA_STATE_MISMATCH",
      TIMEOUT: "CUA_TIMEOUT",
      INTERRUPTED: "CUA_INTERRUPTED",
    }
    for (const [status, signal] of Object.entries(map)) {
      const actual = toCuaRuntimeSignal(status as CuaEnvironmentStatus)
      expect(actual).toBe(signal)
      if (actual) expect(security.has(actual)).toBe(false)
    }
  })

  it("parses the installed driver's health report; any failure or unexpected text is NOT_READY", () => {
    expect(parseCuaHealthReport(HEALTHY)).toEqual({ status: "READY", version: "0.30.4", failedChecks: [] })
    const degraded = HEALTHY.replace("— ok", "— degraded").replace("✅ screen_capture_capability", "❌ screen_capture_capability")
    const r = parseCuaHealthReport(degraded)
    expect(r.status).toBe("NOT_READY")
    expect(r.failedChecks).toEqual(["screen_capture_capability"])
    expect(parseCuaHealthReport("").status).toBe("NOT_READY")
    expect(parseCuaHealthReport("garbage — ok").status).toBe("NOT_READY")
  })
})

// ── Structural (static) proofs ──────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..")
function listTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === "tests") continue
      out.push(...listTs(full))
    } else if (full.endsWith(".ts")) out.push(full)
  }
  return out
}

describe("Section H / F — no agent-reachable path can approve or escalate", () => {
  // Everything reachable from the MCP / gateway request path.
  const agentReachableDirs = ["mcp", "execution", "capabilities", "authorization", "execution-gate", "autonomy", "auth", "identity", "http"]
    .map((d) => path.join(ROOT, d))
    .filter((d) => {
      try {
        return statSync(d).isDirectory()
      } catch {
        return false
      }
    })
  const files = agentReachableDirs.flatMap(listTs)

  it("finds the agent-reachable modules (sanity)", () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it("no agent-reachable module imports the human decision service or the human session resolver", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      const imports = src.match(/from\s+["'][^"']+["']/g) ?? []
      for (const imp of imports) {
        expect(imp, path.relative(ROOT, f)).not.toMatch(/approvals\/decision-service|approvals\/human-session/)
      }
    }
  })

  it("no agent-reachable module references the human decision functions at all", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      expect(src, path.relative(ROOT, f)).not.toMatch(/\b(decideApproval|startApprovalStepUp|cancelApprovalByHuman|requireHumanApprover)\b/)
    }
  })

  it("no agent-reachable module writes autonomy policy (only the admin route does)", () => {
    for (const f of files) {
      if (f.endsWith(path.join("autonomy", "policy-store.ts")) || f.endsWith(path.join("autonomy", "index.ts"))) continue
      const src = readFileSync(f, "utf8")
      expect(src, path.relative(ROOT, f)).not.toMatch(/setAutonomyPolicy|disableAutonomyPolicy|agentAutonomyPolicy\.(create|update|upsert|delete)/)
    }
  })

  it("no capability in the manifest targets approvals, autonomy or Cua", async () => {
    const { CORE_CAPABILITY_MANIFEST } = await import("../capabilities/manifest")
    for (const c of CORE_CAPABILITY_MANIFEST) {
      expect(c.domain).not.toMatch(/approval|autonomy|cua|governance/i)
      expect(c.id).not.toMatch(/approv|autonomy|cua/i)
    }
  })

  it("the backend never invokes Cua (no pipe, process spawn, or cua-driver call in gateway code)", () => {
    // dangerous-primitive-guard.ts is Phase 3's BLOCKLIST of these very names (strings, not calls).
    for (const f of listTs(ROOT).filter((f) => !f.endsWith("dangerous-primitive-guard.ts"))) {
      // Code only — the Cua contract's documentation legitimately mentions the pipe name.
      const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
      expect(code, path.relative(ROOT, f)).not.toMatch(/child_process|\\\\\.\\pipe|spawn\(|execFile\(|createConnection\(/)
    }
  })
})
