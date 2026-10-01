/**
 * lib/agent-gateway/simulation/invariants.ts
 *
 * Phase 14 — platform invariants checked after EVERY simulated scenario
 * (benign, adversarial, red-team, fuzz, regression). They are evaluated
 * over what agents observed and over a snapshot of the world, never over
 * the gateway's own claims, so a control that silently stopped working is
 * caught by its effect.
 *
 *   I1 NO_CROSS_TENANT_LEAK   an agent never sees another owner's private data
 *   I2 NO_SECRET_LEAK         nothing credential-shaped reaches an agent
 *   I3 STABLE_ERRORS          errors are stable codes, never internals / stack traces
 *   I4 NO_UNAUDITED_WRITE     every write effect has a ledger intent and success
 *   I5 NO_UNAUTHORIZED_WRITE  every write execution follows a gate grant
 *   I6 OWNER_ONLY_WRITES      every write effect belongs to the acting owner
 *   I7 NEVER_EXECUTABLE       described-only / internal / forbidden capabilities never execute
 *   I8 APPROVAL_SINGLE_USE    an approval is consumed at most once
 *   I9 LEDGER_INTEGRITY       the hash chain verifies
 *
 * Pure: no I/O, no clock, no randomness.
 */
import { containsSecret } from "../security/secret-patterns"
import type { InvariantViolation, Observation, WorldSnapshot } from "./types"

export interface InvariantContext {
  /** Capability ids that must never produce an execution event (no adapter, INTERNAL_ONLY, FORBIDDEN). */
  neverExecutable: readonly string[]
}

export const INVARIANT_IDS = [
  "NO_CROSS_TENANT_LEAK",
  "NO_SECRET_LEAK",
  "STABLE_ERRORS",
  "NO_UNAUDITED_WRITE",
  "NO_UNAUTHORIZED_WRITE",
  "OWNER_ONLY_WRITES",
  "NEVER_EXECUTABLE",
  "APPROVAL_SINGLE_USE",
  "LEDGER_INTEGRITY",
] as const
export type InvariantId = (typeof INVARIANT_IDS)[number]

const STABLE_ERROR = /^(?:[A-Z][A-Z0-9_]{2,63}: |MCP error -32\d{3}: )/
const INTERNAL_LEAK = /PrismaClient|Invalid `prisma\.|\n\s+at [\w.<>]+ \(|node_modules|ECONNREFUSED|TypeError:|ReferenceError:|SyntaxError:|\bstack\b/

/** Grants that may authorise an execution (same requestId, earlier in the chain). */
const GRANT_ACTIONS = new Set(["authorization.allowed", "approval.consumed", "recovery.executing"])

export function checkInvariants(observations: readonly Observation[], world: WorldSnapshot, ctx: InvariantContext): InvariantViolation[] {
  const v: InvariantViolation[] = []

  // I1 — another owner's markers never appear in what an actor observed.
  for (const o of observations) {
    if (!o.actor) continue
    for (const [owner, markers] of Object.entries(world.tenantMarkers)) {
      if (owner === o.actor.ownerId) continue
      const leaked = markers.find((m) => m.length >= 6 && o.text.includes(m))
      if (leaked) v.push({ invariant: "NO_CROSS_TENANT_LEAK", detail: `${o.actor.ownerId} observed data of ${owner}`, stepIndex: o.index })
    }
  }

  // I2 — no credential-shaped text in anything an agent received.
  for (const o of observations) {
    if (containsSecret(o.text)) v.push({ invariant: "NO_SECRET_LEAK", detail: `credential-shaped text in step ${o.index}`, stepIndex: o.index })
  }

  // I3 — errors are stable codes without internals.
  for (const o of observations) {
    if (!o.isError) continue
    if (!STABLE_ERROR.test(o.message ?? o.text)) v.push({ invariant: "STABLE_ERRORS", detail: `unstable error format in step ${o.index}`, stepIndex: o.index })
    if (INTERNAL_LEAK.test(o.text)) v.push({ invariant: "STABLE_ERRORS", detail: `internal detail in step ${o.index}`, stepIndex: o.index })
  }

  const ledger = [...world.ledger].sort((a, b) => a.sequence - b.sequence)
  const writeSuccesses = ledger.filter((e) => e.action === "execution.succeeded" && e.riskTier !== null && e.riskTier !== "READ")

  // I4 — each write effect is matched by a write success; each success had an intent first.
  if (world.writes.length > writeSuccesses.length) {
    v.push({ invariant: "NO_UNAUDITED_WRITE", detail: `${world.writes.length} write effects but ${writeSuccesses.length} audited write executions` })
  }
  for (const s of writeSuccesses) {
    const intent = ledger.find((e) => e.sequence < s.sequence && e.action === "execution.started" && e.requestId === s.requestId && e.capabilityId === s.capabilityId)
    if (!intent) v.push({ invariant: "NO_UNAUDITED_WRITE", detail: `${s.capabilityId} succeeded without a recorded intent (seq ${s.sequence})` })
  }

  // I5 — each write intent follows a gate grant for the same request.
  for (const started of ledger.filter((e) => e.action === "execution.started")) {
    const grant = ledger.find((e) => e.sequence < started.sequence && e.requestId === started.requestId && GRANT_ACTIONS.has(e.action))
    if (!grant) v.push({ invariant: "NO_UNAUTHORIZED_WRITE", detail: `${started.capabilityId} started without a gate grant (seq ${started.sequence})` })
  }

  // I6 — write effects belong to the owner of a connection that executed a write.
  const writingOwners = new Set(writeSuccesses.map((s) => s.ownerId))
  for (const w of world.writes) {
    if (!writingOwners.has(w.ownerId)) v.push({ invariant: "OWNER_ONLY_WRITES", detail: `${w.model} ${w.id} belongs to ${w.ownerId}, who executed no write` })
  }

  // I7 — never-executable capabilities produce no execution event.
  for (const e of ledger) {
    if (e.action.startsWith("execution.") && e.capabilityId && ctx.neverExecutable.includes(e.capabilityId)) {
      v.push({ invariant: "NEVER_EXECUTABLE", detail: `${e.capabilityId} reached ${e.action}` })
    }
  }

  // I8 — approvals are single-use.
  for (const a of world.approvals) {
    if (a.consumedCount > 1) v.push({ invariant: "APPROVAL_SINGLE_USE", detail: `${a.publicRef} consumed ${a.consumedCount} times` })
  }

  // I9 — the evidence chain is intact.
  if (!world.ledgerChainValid) v.push({ invariant: "LEDGER_INTEGRITY", detail: "the audit ledger chain does not verify" })

  return v
}
