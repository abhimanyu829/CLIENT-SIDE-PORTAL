/**
 * lib/agent-gateway/simulation — Phase 14 agent simulation engine.
 *
 * Deliberately NOT exported from lib/agent-gateway/index.ts and never
 * imported by a route, page, worker or production module (enforced by
 * p14-simulation.test.ts). Docs: docs/agent-gateway/phase-14/.
 */
export * from "./types"
export { checkInvariants, INVARIANT_IDS, type InvariantContext, type InvariantId } from "./invariants"
export { runScenario, assertSimulationEnvironment, SimulationEnvironmentError, errorCodeOf, type RunOptions } from "./runner"
export { mulberry32, fuzzCases, hostileValue, deepValue, type FuzzCase, type Rng } from "./fuzzer"
export { SIM_WORLD, ALPHA, BRAVO, PLANTED_SECRET, NEVER_EXECUTABLE } from "./world"
export { BENIGN_SCENARIOS, ADVERSARIAL_SCENARIOS, RED_TEAM_SCENARIOS } from "./scenarios"
export { SECURITY_REGRESSION_CORPUS } from "./corpus"
