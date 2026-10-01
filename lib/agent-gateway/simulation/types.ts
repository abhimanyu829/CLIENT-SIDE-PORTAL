/**
 * lib/agent-gateway/simulation/types.ts
 *
 * Phase 14 — the scenario model of the agent simulation engine.
 *
 * A scenario is DATA: an ordered list of steps an agent (or an operator)
 * performs against the real gateway, plus per-step expectations. The
 * engine (runner.ts) never talks to the gateway itself: a
 * `SimulationDriver` executes each step and returns what an agent would
 * observe, and snapshots the world (ledger, effects, approvals) for the
 * platform invariants (invariants.ts). The only driver lives in the test
 * tree, on the real MCP server, gate, resolver, task engine and ledger
 * with in-memory datastores; the engine has no HTTP surface and refuses to
 * run in production (runner.ts).
 */

export type ScenarioCategory = "BENIGN" | "ADVERSARIAL" | "RED_TEAM" | "FUZZ" | "REGRESSION"

/** Who performs a step: an agent connection (the driver maps it to a verified identity). */
export interface SimActor {
  connectionId: string
  ownerId: string
}

export type SimStep =
  | { kind: "tool"; actor: SimActor; name: string; args: unknown; meta?: Record<string, unknown>; expect?: StepExpectation; label?: string }
  | { kind: "task_submit"; actor: SimActor; capabilityId: string; input: unknown; idempotencyKey?: string; expect?: StepExpectation; label?: string }
  | { kind: "drain"; label?: string }
  /** A human approves the most recent pending approval requested by `actor` (operator action, never agent-callable). */
  | { kind: "approve_latest"; actor: SimActor; label?: string }
  | { kind: "list_tools"; actor: SimActor; expect?: { includes?: string[]; excludes?: string[] }; label?: string }

export type StepExpectation =
  | { outcome: "ok" }
  | { outcome: "error"; code?: string }
  | { outcome: "approval_required" }
  | { outcome: "any" }

export interface Scenario {
  id: string
  title: string
  category: ScenarioCategory
  /** Phase / bug reference for regression corpus entries. */
  reference?: string
  steps: SimStep[]
}

/** What the agent saw for one step. */
export interface Observation {
  index: number
  kind: SimStep["kind"]
  label?: string
  actor?: SimActor
  name?: string
  isError: boolean
  /** Stable error code parsed from the error text ("CODE: message"), or "MCP_PROTOCOL" for SDK-level validation errors. */
  code: string | null
  /** Everything the agent received, as text (all content blocks + structured content + _meta). */
  text: string
  /** The first content block's text (where an error's "CODE: message" lives). Defaults to `text`. */
  message?: string
  /** The parsed first content block, when it was JSON. */
  output?: unknown
  /** For list_tools. */
  tools?: string[]
}

/** A business effect the driver detected (a row created or changed by a write capability). */
export interface WriteEffect {
  model: string
  id: string
  ownerId: string
  change: "created" | "updated"
}

export interface LedgerEventView {
  sequence: number
  action: string
  outcome: string
  requestId: string | null
  connectionId: string | null
  ownerId: string | null
  capabilityId: string | null
  riskTier: string | null
}

export interface WorldSnapshot {
  ledger: LedgerEventView[]
  ledgerChainValid: boolean
  writes: WriteEffect[]
  /** Text that belongs to exactly one owner (seeded private data); never visible to another owner. */
  tenantMarkers: Record<string, string[]>
  /** Approval rows: how many times each was consumed. */
  approvals: Array<{ publicRef: string; status: string; consumedCount: number }>
}

export interface SimulationDriver {
  execute(step: SimStep, index: number): Promise<Observation>
  snapshot(): Promise<WorldSnapshot>
}

export interface InvariantViolation {
  invariant: string
  detail: string
  stepIndex?: number
}

export interface ScenarioResult {
  scenarioId: string
  observations: Observation[]
  expectationFailures: InvariantViolation[]
  violations: InvariantViolation[]
  passed: boolean
}
