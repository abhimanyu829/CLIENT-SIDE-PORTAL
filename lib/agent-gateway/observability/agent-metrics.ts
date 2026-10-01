/**
 * lib/agent-gateway/observability/agent-metrics.ts
 *
 * Phase 11 — labelled agent metrics, an extension of the existing
 * in-process metrics module (observability/metrics.ts keeps its unlabelled
 * gateway_* counters unchanged).
 *
 * Cardinality is bounded BY CONSTRUCTION: every metric declares its label
 * keys, and every label value is checked against a closed vocabulary.
 * Capability labels accept only registered capability ids; reason / error
 * labels accept only UPPER_SNAKE codes; anything else becomes "other".
 * Raw input, resource ids, tokens, owner ids and free text can never become
 * a label value.
 *
 * Process-local, like the existing counters. Durable, cross-instance health
 * signals (Phase 15 health gates) are computed from Postgres (the audit
 * ledger and AgentTask), not from these counters.
 */

export const AGENT_COUNTERS = {
  agent_requests_total: ["protocol", "outcome"],
  agent_authorization_total: ["decision", "risk_tier"],
  agent_approval_total: ["outcome"],
  agent_execution_total: ["capability", "outcome", "risk_tier"],
  agent_task_created_total: ["capability"],
  agent_task_succeeded_total: ["capability"],
  agent_task_failed_total: ["capability", "reason"],
  agent_task_retry_total: ["capability"],
  agent_trigger_total: ["source", "outcome"],
  agent_security_denial_total: ["reason"],
  agent_rollback_total: ["outcome", "recovery_class"],
  agent_audit_append_total: ["category", "outcome"],
  agent_circuit_transition_total: ["scope", "state"],
  agent_kill_switch_block_total: ["scope"],
  agent_rollout_block_total: ["stage"],
  // Phase 12 — content security findings (secrets removed, injection signals, refused inputs / outputs / outbound calls).
  agent_content_findings_total: ["kind", "capability"],
} as const

export const AGENT_HISTOGRAMS = {
  agent_execution_duration_ms: ["capability", "outcome"],
  agent_policy_evaluation_duration_ms: ["decision"],
  agent_task_queue_latency_ms: ["capability"],
  agent_audit_append_duration_ms: ["outcome"],
} as const

export type AgentCounterName = keyof typeof AGENT_COUNTERS
export type AgentHistogramName = keyof typeof AGENT_HISTOGRAMS
export type MetricLabels = Record<string, string | number | null | undefined>

export const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const

const CLOSED_VALUES: Record<string, ReadonlySet<string>> = {
  protocol: new Set(["MCP", "HTTP", "WEBHOOK", "WORKER", "GOVERNANCE"]),
  outcome: new Set(["SUCCESS", "FAILURE", "DENIED", "ALLOWED", "APPROVAL_REQUIRED", "ERROR", "REPLAYED", "SKIPPED", "MANUAL", "TASK_CREATED", "DROPPED", "PENDING", "DUPLICATE", "FAILED"]),
  decision: new Set(["ALLOW", "DENY", "REQUIRES_APPROVAL", "POLICY_UNAVAILABLE", "ALLOWED", "DENIED", "APPROVAL_REQUIRED"]),
  risk_tier: new Set(["READ", "LOW_RISK_WRITE", "HIGH_RISK_MUTATION", "CRITICAL"]),
  source: new Set(["EVENT", "WEBHOOK", "SCHEDULE"]),
  scope: new Set(["GLOBAL", "ENVIRONMENT", "DOMAIN", "CAPABILITY", "CONNECTION", "TRIGGER", "ADAPTER"]),
  state: new Set(["CLOSED", "OPEN", "HALF_OPEN"]),
  stage: new Set(["DISABLED", "INTERNAL", "CANARY", "LIMITED", "EXPANDED", "ACTIVE", "PAUSED", "ROLLED_BACK", "NONE"]),
  recovery_class: new Set(["REVERSIBLE", "COMPENSATABLE", "PARTIALLY_REVERSIBLE", "IRREVERSIBLE"]),
  kind: new Set(["SECRET_REDACTED", "INJECTION_SUSPECTED", "INPUT_REJECTED", "OUTPUT_WITHHELD", "OUTBOUND_BLOCKED"]),
  category: new Set([
    "AUTHENTICATION",
    "IDENTITY",
    "CAPABILITY",
    "AUTHORIZATION",
    "APPROVAL",
    "AUTONOMY",
    "EXECUTION",
    "TASK",
    "TRIGGER",
    "WEBHOOK",
    "SCHEDULE",
    "POLICY",
    "SECURITY",
    "FAILURE",
    "ROLLBACK",
    "ADMIN_GOVERNANCE",
    "CONFIGURATION",
  ]),
}

const CODE_VALUE = /^[A-Z][A-Z0-9_]{1,63}$/
let knownCapabilities: ReadonlySet<string> = new Set()

/** Called by the capability registry singleton: only registered ids may become a capability label. */
export function setKnownCapabilityIds(ids: Iterable<string>): void {
  knownCapabilities = new Set(ids)
}

function boundLabel(key: string, raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "none"
  const value = String(raw)
  if (key === "capability") return knownCapabilities.has(value) ? value : "other"
  if (key === "reason") return CODE_VALUE.test(value) ? value : "other"
  const closed = CLOSED_VALUES[key]
  if (closed) return closed.has(value) ? value : "other"
  return "other"
}

function seriesKey(keys: readonly string[], labels: MetricLabels): string {
  return keys.map((k) => `${k}=${boundLabel(k, labels[k])}`).join(",")
}

const counters = new Map<string, Map<string, number>>()
interface HistogramSeries {
  buckets: number[]
  count: number
  sum: number
}
const histograms = new Map<string, Map<string, HistogramSeries>>()

export function countMetric(name: AgentCounterName, labels: MetricLabels = {}, by = 1): void {
  try {
    const key = seriesKey(AGENT_COUNTERS[name], labels)
    const series = counters.get(name) ?? new Map<string, number>()
    series.set(key, (series.get(key) ?? 0) + by)
    counters.set(name, series)
  } catch {
    // Metrics never affect the measured operation.
  }
}

export function observeMetric(name: AgentHistogramName, valueMs: number, labels: MetricLabels = {}): void {
  try {
    if (!Number.isFinite(valueMs) || valueMs < 0) return
    const key = seriesKey(AGENT_HISTOGRAMS[name], labels)
    const series = histograms.get(name) ?? new Map<string, HistogramSeries>()
    const entry = series.get(key) ?? { buckets: new Array(DURATION_BUCKETS_MS.length + 1).fill(0), count: 0, sum: 0 }
    const index = DURATION_BUCKETS_MS.findIndex((b) => valueMs <= b)
    entry.buckets[index === -1 ? DURATION_BUCKETS_MS.length : index] += 1
    entry.count += 1
    entry.sum += valueMs
    series.set(key, entry)
    histograms.set(name, series)
  } catch {
    // Metrics never affect the measured operation.
  }
}

export interface AgentMetricsSnapshot {
  counters: Record<string, Record<string, number>>
  histograms: Record<string, Record<string, HistogramSeries>>
}

export function getAgentMetricsSnapshot(): AgentMetricsSnapshot {
  const out: AgentMetricsSnapshot = { counters: {}, histograms: {} }
  for (const [name, series] of counters) out.counters[name] = Object.fromEntries(series)
  for (const [name, series] of histograms) {
    out.histograms[name] = Object.fromEntries(Array.from(series, ([k, v]) => [k, { ...v, buckets: [...v.buckets] }]))
  }
  return out
}

/** Sum of a counter across all label series matching `filter` (e.g. { outcome: "FAILURE" }). */
export function counterTotal(name: AgentCounterName, filter: MetricLabels = {}): number {
  const series = counters.get(name)
  if (!series) return 0
  let total = 0
  for (const [key, value] of series) {
    const parts = Object.fromEntries(key.split(",").map((p) => p.split("=") as [string, string]))
    if (Object.entries(filter).every(([k, v]) => parts[k] === boundLabel(k, v))) total += value
  }
  return total
}

/** Test-only. */
export function __resetAgentMetricsForTests(): void {
  counters.clear()
  histograms.clear()
}
