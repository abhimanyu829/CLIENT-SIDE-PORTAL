/**
 * lib/agent-gateway/human-in-the-loop/cua-contract.ts
 *
 * The narrow integration boundary between the Phase 7 approval engine and the
 * ALREADY-INSTALLED Cua Driver (cua-driver 0.30.4, verified in the Step 0
 * audit). Nothing here re-implements, wraps, launches or configures Cua.
 *
 * TRUST BOUNDARY
 *   Cua is authoritative for DESKTOP facts: which window is open, what the
 *   approval surface shows, whether a postcondition is visible.
 *   The Abhibhi backend is authoritative for APPROVAL facts: whether a
 *   request exists, who decided it, whether it is valid, bound, unexpired
 *   and unconsumed.
 *
 *   These are separate facts and are never merged. In particular:
 *     "Cua observed an Approved screen" is NOT "the backend approved".
 *   `cuaObservationCanGrantApproval()` below always returns false and is
 *   asserted by the Phase 7 test suite, so no future change can quietly
 *   start treating a desktop observation as an approval.
 *
 * DEPLOYMENT REALITY
 *   Cua runs as a local desktop daemon (named pipe \\.\pipe\cua-driver)
 *   attached to the AGENT RUNTIME's MCP client. The Next.js server runs in a
 *   container and cannot — and must not — reach that pipe. The backend
 *   therefore never calls Cua. It only (a) describes the approval surface
 *   the runtime should present, and (b) interprets observations the runtime
 *   reports, strictly as advisory environment signals.
 */

/** Result vocabulary of an approval-environment check (spec's CuaEnvironmentVerifier). */
export type CuaEnvironmentStatus =
  | "READY"
  | "NOT_READY"
  | "PERMISSION_DENIED"
  | "TARGET_NOT_FOUND"
  | "UNEXPECTED_STATE"
  | "TIMEOUT"
  | "INTERRUPTED"

/**
 * Environment/runtime failure codes. These are deliberately a DIFFERENT
 * vocabulary from security decisions (AUTHORIZATION_DENIED,
 * APPROVAL_REJECTED, POLICY_DENY): a desktop problem is never reported as —
 * or converted into — an approval or denial decision.
 */
export type CuaRuntimeSignal =
  | "CUA_DESKTOP_UNAVAILABLE"
  | "CUA_PERMISSION_DENIED"
  | "CUA_TARGET_APPLICATION_MISSING"
  | "CUA_APPROVAL_SURFACE_UNAVAILABLE"
  | "CUA_STATE_MISMATCH"
  | "CUA_TIMEOUT"
  | "CUA_INTERRUPTED"
  | "CUA_POSTCONDITION_FAILED"

/** What the agent runtime should present to the human through Cua. */
export interface ApprovalSurfaceDescriptor {
  /** Relative path of the existing admin approval page for this request. */
  path: string
  /** Text that must be visible for the surface to count as "the right request". */
  expectedReference: string
  /** Visible window title fragment of the approval page. */
  expectedTitleFragment: string
}

/** An observation reported by the agent runtime after using Cua. Advisory only. */
export interface CuaObservation {
  status: CuaEnvironmentStatus
  /** The approval reference Cua actually saw on screen, if any. */
  observedReference?: string | null
  /** Free-form, non-sensitive note (window title, app name). Never trusted for decisions. */
  detail?: string
}

/**
 * The bridge the agent runtime implements with its own Cua MCP tools
 * (launch_app / list_windows / get_window_state / verify_state). The
 * backend only defines the contract.
 *
 * A bridge MUST NOT: decide authorization or autonomy, create/alter approval
 * records, submit approval decisions, change Cua's permission mode, or run
 * backend business mutations. It has no method for any of those.
 */
export interface CuaApprovalBridge {
  verifyApprovalEnvironment(): Promise<CuaObservation>
  presentApprovalSurface(surface: ApprovalSurfaceDescriptor): Promise<CuaObservation>
  observeApprovalSurface(surface: ApprovalSurfaceDescriptor): Promise<CuaObservation>
}

export const APPROVAL_SURFACE_TITLE = "Agent approval"

export function describeApprovalSurface(publicRef: string): ApprovalSurfaceDescriptor {
  return {
    path: `/admin/agent-approvals/${encodeURIComponent(publicRef)}`,
    expectedReference: publicRef,
    expectedTitleFragment: APPROVAL_SURFACE_TITLE,
  }
}

/**
 * The invariant: a desktop observation — whatever it contains — never
 * approves anything. Kept as an explicit, tested function rather than an
 * implied absence of code.
 */
export function cuaObservationCanGrantApproval(_observation: CuaObservation): false {
  return false
}

/** Maps an environment status to the runtime signal an agent should report. */
export function toCuaRuntimeSignal(status: CuaEnvironmentStatus): CuaRuntimeSignal | null {
  switch (status) {
    case "READY":
      return null
    case "PERMISSION_DENIED":
      return "CUA_PERMISSION_DENIED"
    case "TARGET_NOT_FOUND":
      return "CUA_TARGET_APPLICATION_MISSING"
    case "UNEXPECTED_STATE":
      return "CUA_STATE_MISMATCH"
    case "TIMEOUT":
      return "CUA_TIMEOUT"
    case "INTERRUPTED":
      return "CUA_INTERRUPTED"
    case "NOT_READY":
    default:
      return "CUA_DESKTOP_UNAVAILABLE"
  }
}

/**
 * Checks that what Cua saw is the expected surface for THIS request. A
 * mismatch (wrong window, a different or stale request reference) is an
 * environment problem — reported as CUA_STATE_MISMATCH, never as a decision.
 */
export function evaluateObservationAgainstSurface(
  observation: CuaObservation,
  surface: ApprovalSurfaceDescriptor
): { status: CuaEnvironmentStatus; signal: CuaRuntimeSignal | null } {
  if (observation.status !== "READY") return { status: observation.status, signal: toCuaRuntimeSignal(observation.status) }
  if (!observation.observedReference || observation.observedReference !== surface.expectedReference) {
    return { status: "UNEXPECTED_STATE", signal: "CUA_STATE_MISMATCH" }
  }
  return { status: "READY", signal: null }
}

/**
 * Interprets the text of the installed driver's own `health_report` tool
 * (format verified against cua-driver 0.30.4 during the Step 0 audit):
 * a header line ending in "— ok" when every non-skipped check passes, and
 * one "✅"/"❌"/"⏭" line per check. Anything unexpected is NOT_READY.
 */
export function parseCuaHealthReport(text: string): { status: CuaEnvironmentStatus; version: string | null; failedChecks: string[] } {
  const header = text.split(/\r?\n/)[0] ?? ""
  const versionMatch = /cua-driver\s+(\d+\.\d+\.\d+)/.exec(header)
  const failedChecks = text
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("❌"))
    .map((line) => line.replace("❌", "").trim().split(":")[0])
  const required = ["session_active", "ax_capability", "screen_capture_capability"]
  const passing = required.every((check) => new RegExp(`✅\\s*${check}:`).test(text))
  const headerOk = /—\s*ok\s*$/.test(header.trim())
  return {
    status: headerOk && passing && failedChecks.length === 0 ? "READY" : "NOT_READY",
    version: versionMatch?.[1] ?? null,
    failedChecks,
  }
}
