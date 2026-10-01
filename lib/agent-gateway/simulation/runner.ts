/**
 * lib/agent-gateway/simulation/runner.ts
 *
 * Phase 14 — runs scenarios through a SimulationDriver and checks the
 * per-step expectations and the platform invariants.
 *
 * Environment guard: the engine refuses to run against a "production"
 * gateway environment. It has no HTTP surface (no route imports it; a
 * static test enforces that), so it can only be invoked from code that
 * already runs inside the trusted test or tooling process.
 */
import { checkInvariants, type InvariantContext } from "./invariants"
import type { InvariantViolation, Observation, Scenario, ScenarioResult, SimulationDriver, StepExpectation } from "./types"

export class SimulationEnvironmentError extends Error {
  constructor(environment: string) {
    super(`The agent simulation engine never runs against the "${environment}" environment.`)
    this.name = "SimulationEnvironmentError"
  }
}

export interface RunOptions {
  /** The gateway environment the driver is bound to (from the gateway configuration, never from a scenario). */
  environment: string
  invariants: InvariantContext
}

export function assertSimulationEnvironment(environment: string): void {
  if (environment !== "development" && environment !== "staging") throw new SimulationEnvironmentError(environment)
}

function expectationFailure(o: Observation, expect: StepExpectation | undefined): string | null {
  if (!expect || expect.outcome === "any") return null
  const approval = o.isError && o.code === "APPROVAL_REQUIRED"
  switch (expect.outcome) {
    case "ok":
      return o.isError ? `expected success, got ${o.code ?? "error"}` : null
    case "approval_required":
      return approval ? null : `expected APPROVAL_REQUIRED, got ${o.isError ? o.code : "success"}`
    case "error":
      if (!o.isError) return "expected an error, got success"
      if (approval) return "expected a refusal, got an approval request"
      if (expect.code && o.code !== expect.code) return `expected ${expect.code}, got ${o.code}`
      return null
  }
}

export async function runScenario(scenario: Scenario, driver: SimulationDriver, options: RunOptions): Promise<ScenarioResult> {
  assertSimulationEnvironment(options.environment)
  const observations: Observation[] = []
  const expectationFailures: InvariantViolation[] = []
  for (let index = 0; index < scenario.steps.length; index += 1) {
    const step = resolveStep(scenario.steps[index], observations)
    const o = await driver.execute(step, index)
    observations.push(o)
    if (step.kind === "tool" || step.kind === "task_submit") {
      const failure = expectationFailure(o, step.expect)
      if (failure) expectationFailures.push({ invariant: "EXPECTATION", detail: `${step.label ?? step.kind}: ${failure}`, stepIndex: index })
    }
    if (step.kind === "list_tools" && step.expect) {
      for (const name of step.expect.includes ?? []) if (!o.tools?.includes(name)) expectationFailures.push({ invariant: "EXPECTATION", detail: `tool ${name} not listed`, stepIndex: index })
      for (const name of step.expect.excludes ?? []) if (o.tools?.includes(name)) expectationFailures.push({ invariant: "EXPECTATION", detail: `tool ${name} listed`, stepIndex: index })
    }
  }
  const violations = checkInvariants(observations, await driver.snapshot(), options.invariants)
  return { scenarioId: scenario.id, observations, expectationFailures, violations, passed: expectationFailures.length === 0 && violations.length === 0 }
}

/**
 * Step references: a string "$ref:<label>.<field>" in tool args / task
 * input is replaced by `field` of the JSON output of the earlier step with
 * that label (e.g. the taskRef a previous submit returned). Unresolvable
 * references become the literal "unresolved" (and the step then fails as
 * any bad input would).
 */
const REF = /^\$ref:([A-Za-z0-9_-]{1,40})\.([A-Za-z0-9_]{1,40})$/

function resolveValue(value: unknown, observations: readonly Observation[]): unknown {
  if (typeof value === "string") {
    const m = REF.exec(value)
    if (!m) return value
    const source = observations.find((o) => o.label === m[1])?.output as Record<string, unknown> | undefined
    const resolved = source?.[m[2]]
    return typeof resolved === "string" || typeof resolved === "number" ? resolved : "unresolved"
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, observations))
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v, observations)]))
  return value
}

function resolveStep(step: Scenario["steps"][number], observations: readonly Observation[]): Scenario["steps"][number] {
  if (step.kind === "tool") return { ...step, args: resolveValue(step.args, observations) }
  if (step.kind === "task_submit") return { ...step, input: resolveValue(step.input, observations) }
  return step
}

/** Parses the stable error code of a tool result text. */
export function errorCodeOf(text: string): string | null {
  const stable = /^([A-Z][A-Z0-9_]{2,63}): /.exec(text)
  if (stable) return stable[1]
  if (/^MCP error -32\d{3}: /.test(text)) return "MCP_PROTOCOL"
  return null
}
