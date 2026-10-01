/**
 * lib/agent-gateway/capabilities/registry-evidence.ts
 *
 * Phase 12 (supply chain) — the capability surface in force is evidence.
 *
 * On the first agent request a process serves, the live registry's
 * fingerprint (capabilities/manifest-summary.ts) is compared with the last
 * one recorded in the audit ledger and appended as
 * `capability_registry.loaded` only when it differs — i.e. once per
 * deployment that changes what agents can do, not once per process. The
 * full fingerprint is stored in the event's inputDigest column (a 64-hex
 * value would be redacted from metadata as secret-shaped); metadata carries
 * the capability count and a 128-bit prefix for display.
 *
 * Best effort: a ledger failure never affects the request that triggered it.
 */
import { findLatestEventByAction } from "../audit-ledger/ledger"
import { recordAuditDeferred } from "../audit-ledger/recorder"
import type { CapabilityRegistry } from "./registry"
import { manifestFingerprint } from "./manifest-summary"

export function recordRegistryFingerprint(registry: CapabilityRegistry): void {
  let fingerprint: string
  let count: number
  try {
    const defs = registry.list({ includeDisabled: true, includeForbidden: true })
    fingerprint = manifestFingerprint(defs)
    count = defs.length
  } catch {
    return
  }
  recordAuditDeferred(async () => {
    const latest = await findLatestEventByAction("capability_registry.loaded")
    if (latest?.inputDigest === fingerprint) return null
    return {
      action: "capability_registry.loaded",
      outcome: "INFO",
      actor: { type: "SYSTEM" },
      resourceType: "CapabilityRegistry",
      inputDigest: fingerprint,
      metadata: { capabilityCount: count, registryFingerprint: fingerprint.slice(0, 32) },
    }
  })
}

let scheduled = false

/** Once per process, on the first agent request. */
export function recordRegistryFingerprintOnce(getRegistry: () => CapabilityRegistry): void {
  if (scheduled) return
  scheduled = true
  try {
    recordRegistryFingerprint(getRegistry())
  } catch {
    // never affects the request
  }
}

/** Test-only. */
export function __resetRegistryFingerprintForTests(): void {
  scheduled = false
}
