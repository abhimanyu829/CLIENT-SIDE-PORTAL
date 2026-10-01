/**
 * lib/agent-gateway/resilience/circuit-breaker.ts
 *
 * Phase 11 — scoped circuit breakers for agent executions.
 *
 * A breaker opens when one scope keeps failing for infrastructure reasons
 * (EXECUTION_UNAVAILABLE, INTERNAL_ERROR, TIMEOUT), so a broken adapter or
 * downstream service stops receiving agent traffic while it is broken.
 * Caller errors (invalid input, not found, forbidden, conflict) never
 * count. Scopes are narrow — CAPABILITY, ADAPTER, CONNECTION — so one
 * failing capability never disables the rest of the platform, and nothing
 * here touches human application traffic.
 *
 *   CLOSED --(failureThreshold failures within windowMs)--> OPEN
 *   OPEN --(cooldownMs elapsed)--> HALF_OPEN (halfOpenProbes trial calls)
 *   HALF_OPEN --success--> CLOSED      HALF_OPEN --failure--> OPEN
 *
 * State is process-local (like the existing metrics): each web / worker
 * process protects itself. Durable, cross-instance safety decisions (pause
 * a rollout) are Phase 15's health gates over Postgres, which a breaker
 * opening feeds through the ledger.
 */
import { recordAudit } from "../audit-ledger/recorder"
import { countMetric } from "../observability/agent-metrics"

export type BreakerScope = "CAPABILITY" | "ADAPTER" | "CONNECTION"
export type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN"

export interface BreakerConfig {
  failureThreshold: number
  windowMs: number
  cooldownMs: number
  halfOpenProbes: number
}

export const DEFAULT_BREAKER_CONFIG: BreakerConfig = { failureThreshold: 5, windowMs: 60_000, cooldownMs: 30_000, halfOpenProbes: 1 }

/**
 * Per-scope overrides. A CONNECTION breaker counts only DISPATCHED
 * infrastructure failures (refusals by an already-open CAPABILITY / ADAPTER
 * breaker never count), so one broken capability opens its own breaker
 * after 5 failures and stops feeding the connection's counter. The
 * connection breaker therefore opens only when one agent keeps failing
 * across capabilities — a much higher bar, so a single broken capability
 * never locks an agent out of everything else.
 */
export const DEFAULT_SCOPE_OVERRIDES: Partial<Record<BreakerScope, Partial<BreakerConfig>>> = { CONNECTION: { failureThreshold: 20 } }

/** Execution error codes that indicate an unhealthy dependency (never a caller error). */
const BREAKER_FAILURE_CODES = new Set(["EXECUTION_UNAVAILABLE", "INTERNAL_ERROR", "TIMEOUT"])

export function isBreakerFailure(code: string): boolean {
  return BREAKER_FAILURE_CODES.has(code)
}

interface BreakerEntry {
  state: BreakerState
  failures: number[]
  openedAt: number | null
  probesInFlight: number
}

export interface BreakerSnapshot {
  scope: BreakerScope
  key: string
  state: BreakerState
  recentFailures: number
  openedAt: string | null
}

export type BreakerCheck = { allowed: true; probe: boolean } | { allowed: false; scope: BreakerScope; key: string; retryAfterMs: number }

export class CircuitBreakerRegistry {
  private readonly entries = new Map<string, BreakerEntry>()

  constructor(
    private readonly config: BreakerConfig = DEFAULT_BREAKER_CONFIG,
    private readonly clock: () => number = () => Date.now(),
    private readonly scopeOverrides: Partial<Record<BreakerScope, Partial<BreakerConfig>>> = DEFAULT_SCOPE_OVERRIDES
  ) {}

  /** The effective configuration of one scope. */
  configFor(scope: BreakerScope): BreakerConfig {
    return { ...this.config, ...(this.scopeOverrides[scope] ?? {}) }
  }

  private entry(scope: BreakerScope, key: string): BreakerEntry {
    const id = `${scope}:${key}`
    let entry = this.entries.get(id)
    if (!entry) {
      entry = { state: "CLOSED", failures: [], openedAt: null, probesInFlight: 0 }
      this.entries.set(id, entry)
    }
    return entry
  }

  private transition(scope: BreakerScope, key: string, entry: BreakerEntry, to: BreakerState): void {
    if (entry.state === to) return
    entry.state = to
    countMetric("agent_circuit_transition_total", { scope, state: to })
    recordAudit({
      action: to === "OPEN" ? "failure.circuit_opened" : to === "HALF_OPEN" ? "failure.circuit_half_open" : "failure.circuit_closed",
      outcome: "INFO",
      actor: { type: "SYSTEM" },
      ...(scope === "CAPABILITY" ? { capabilityId: key } : scope === "CONNECTION" ? { connectionId: key } : { adapterId: key }),
      metadata: { breakerScope: scope, breakerKey: key, failureCount: entry.failures.length },
    })
  }

  /** Whether one call in this scope may run now. A HALF_OPEN breaker admits a bounded number of probes. */
  check(scope: BreakerScope, key: string): BreakerCheck {
    const entry = this.entry(scope, key)
    const config = this.configFor(scope)
    const now = this.clock()
    if (entry.state === "OPEN") {
      const elapsed = now - (entry.openedAt ?? now)
      if (elapsed < config.cooldownMs) return { allowed: false, scope, key, retryAfterMs: config.cooldownMs - elapsed }
      this.transition(scope, key, entry, "HALF_OPEN")
      entry.probesInFlight = 0
    }
    if (entry.state === "HALF_OPEN") {
      if (entry.probesInFlight >= config.halfOpenProbes) return { allowed: false, scope, key, retryAfterMs: 1_000 }
      entry.probesInFlight += 1
      return { allowed: true, probe: true }
    }
    return { allowed: true, probe: false }
  }

  recordSuccess(scope: BreakerScope, key: string): void {
    const entry = this.entry(scope, key)
    if (entry.state === "HALF_OPEN") {
      entry.failures = []
      entry.openedAt = null
      entry.probesInFlight = 0
      this.transition(scope, key, entry, "CLOSED")
    }
  }

  recordFailure(scope: BreakerScope, key: string): void {
    const entry = this.entry(scope, key)
    const now = this.clock()
    if (entry.state === "HALF_OPEN") {
      entry.openedAt = now
      entry.probesInFlight = 0
      entry.failures = [...entry.failures.slice(-50), now]
      this.transition(scope, key, entry, "OPEN")
      return
    }
    if (entry.state === "OPEN") return // refused calls never dispatch; nothing to count
    const config = this.configFor(scope)
    entry.failures = entry.failures.filter((t) => now - t < config.windowMs)
    entry.failures.push(now)
    if (entry.state === "CLOSED" && entry.failures.length >= config.failureThreshold) {
      entry.openedAt = now
      this.transition(scope, key, entry, "OPEN")
    }
  }

  /** Releases a HALF_OPEN probe slot without a verdict (e.g. the call was refused before dispatch). */
  releaseProbe(scope: BreakerScope, key: string): void {
    const entry = this.entry(scope, key)
    if (entry.state === "HALF_OPEN" && entry.probesInFlight > 0) entry.probesInFlight -= 1
  }

  snapshot(): BreakerSnapshot[] {
    const now = this.clock()
    return Array.from(this.entries, ([id, e]) => {
      const sep = id.indexOf(":")
      const scope = id.slice(0, sep) as BreakerScope
      return {
        scope,
        key: id.slice(sep + 1),
        state: e.state,
        recentFailures: e.failures.filter((t) => now - t < this.configFor(scope).windowMs).length,
        openedAt: e.openedAt ? new Date(e.openedAt).toISOString() : null,
      }
    }).filter((s) => s.state !== "CLOSED" || s.recentFailures > 0)
  }

  reset(): void {
    this.entries.clear()
  }
}

let registrySingleton: CircuitBreakerRegistry | null = null

export function getCircuitBreakers(): CircuitBreakerRegistry {
  if (!registrySingleton) registrySingleton = new CircuitBreakerRegistry()
  return registrySingleton
}

/** Test-only: inject a registry (e.g. with a scripted clock or thresholds). */
export function __setCircuitBreakersForTests(registry: CircuitBreakerRegistry | null): void {
  registrySingleton = registry
}
