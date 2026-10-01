/**
 * lib/agent-gateway/security/input-hygiene.ts
 *
 * Phase 12 — structural hygiene of agent-supplied input, applied by the
 * capability registry's validateInput() (so every path gets it: MCP calls,
 * task submission, trigger presets, the worker's re-validation) and by the
 * MCP layer BEFORE the execution gate, so a hostile input never reaches an
 * approval request a human will read.
 *
 * Rejected (each is a recognised attack shape, none is needed by any
 * capability):
 *   CONTROL_CHARACTERS  C0 / C1 controls except tab, line feed, carriage return
 *   BIDI_CONTROL        bidirectional overrides / isolates ("Trojan Source")
 *   TAG_CHARACTERS      Unicode tag block (invisible "ASCII smuggling")
 *   LONE_SURROGATE      malformed UTF-16 (breaks canonicalisation and logs)
 *   PROTOTYPE_KEY       __proto__ / constructor / prototype keys
 *   TOO_DEEP / TOO_MANY_NODES  structural bombs
 * Keys are checked like values. Schema validation (strict zod, Phase 3)
 * still runs afterwards; this module never accepts anything the schema
 * would reject, it only rejects more.
 */

export type InputRejectionReason = "CONTROL_CHARACTERS" | "BIDI_CONTROL" | "TAG_CHARACTERS" | "LONE_SURROGATE" | "PROTOTYPE_KEY" | "TOO_DEEP" | "TOO_MANY_NODES"

export type InputInspection = { ok: true } | { ok: false; reason: InputRejectionReason; path: string }

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/
const BIDI = /[\u202A-\u202E\u2066-\u2069]/
const TAG = /[\u{E0000}-\u{E007F}]/u
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"])

export const MAX_INPUT_DEPTH = 12
export const MAX_INPUT_NODES = 5_000

function textReason(text: string): InputRejectionReason | null {
  if (CONTROL.test(text)) return "CONTROL_CHARACTERS"
  if (BIDI.test(text)) return "BIDI_CONTROL"
  if (TAG.test(text)) return "TAG_CHARACTERS"
  if (LONE_SURROGATE.test(text)) return "LONE_SURROGATE"
  return null
}

/** A display-safe path: identifier segments only, anything else is "?". */
function safeSegment(key: string): string {
  return /^[A-Za-z0-9_]{1,64}$/.test(key) ? key : "?"
}

export function inspectAgentInput(value: unknown): InputInspection {
  let nodes = 0
  let failure: { reason: InputRejectionReason; path: string } | null = null

  const visit = (node: unknown, path: string, depth: number): void => {
    if (failure) return
    nodes += 1
    if (nodes > MAX_INPUT_NODES) {
      failure = { reason: "TOO_MANY_NODES", path }
      return
    }
    if (typeof node === "string") {
      const reason = textReason(node)
      if (reason) failure = { reason, path: path || "$" }
      return
    }
    if (node === null || typeof node !== "object") return
    if (depth >= MAX_INPUT_DEPTH) {
      failure = { reason: "TOO_DEEP", path }
      return
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${path}[${i}]`, depth + 1))
      return
    }
    for (const key of Object.keys(node as Record<string, unknown>)) {
      const keyPath = path ? `${path}.${safeSegment(key)}` : safeSegment(key)
      if (PROTOTYPE_KEYS.has(key)) {
        failure = { reason: "PROTOTYPE_KEY", path: keyPath }
        return
      }
      const reason = textReason(key)
      if (reason) {
        failure = { reason, path: keyPath }
        return
      }
      visit((node as Record<string, unknown>)[key], keyPath, depth + 1)
    }
  }

  visit(value, "", 0)
  return failure ? { ok: false, ...(failure as { reason: InputRejectionReason; path: string }) } : { ok: true }
}

/** The stable details object the registry attaches to its INVALID_INPUT error. */
export interface InputHygieneDetails {
  hygiene: InputRejectionReason
  path: string
}

export function isInputHygieneDetails(details: unknown): details is InputHygieneDetails {
  return typeof details === "object" && details !== null && typeof (details as { hygiene?: unknown }).hygiene === "string"
}
