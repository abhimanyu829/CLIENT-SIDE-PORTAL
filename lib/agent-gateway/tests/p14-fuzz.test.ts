/**
 * Phase 14 D — seeded fuzzing of every agent tool on the real gateway.
 *
 * For each of the 15 tools, cases are generated from a known-valid base by
 * the seeded fuzzer (fuzzer.ts) and sent by both tenants. Per case: the
 * gateway answers (never throws), and a success always satisfies the
 * capability's output contract. Per tool: every platform invariant holds
 * over all observations. Reproduce a failure from (seed, tool, index).
 */
import { describe, expect, it, vi } from "vitest"
import { fuzzCases } from "../simulation/fuzzer"
import { checkInvariants } from "../simulation/invariants"
import { scrubSecrets } from "../security/secret-patterns"
import { ALPHA, BRAVO, NEVER_EXECUTABLE } from "../simulation/world"
import type { Observation } from "../simulation/types"
import { buildSimulationHarness } from "./simulation-test-driver"

vi.setConfig({ testTimeout: 180_000, hookTimeout: 90_000 })

const SEED = 20261001
const CASES_PER_TOOL = 24
const KEY = "abhibhideveloper.online/idempotency-key"

const BASES: Record<string, Record<string, unknown>> = {
  "products.list": { limit: 5 },
  "products.get": { id: "sim_prod_pub" },
  "products.listMine": { status: "AVAILABLE" },
  "campaigns.getActive": {},
  "subscriptions.get": { subscriptionId: "sim_sub_alpha" },
  "subscriptions.list": { limit: 5 },
  "tickets.list": { status: "OPEN" },
  "tickets.get": { ticketId: "sim_tk_alpha" },
  "tickets.create": { subject: "Fuzz subject", description: "Fuzz description text." },
  "tickets.close": { ticketId: "sim_tk_alpha" },
  "analytics.summary": {},
  "analytics.productPerformance": { productId: "sim_prod_pub", days: 30 },
  agent_task_submit: { capabilityId: "tickets.list", input: {} },
  agent_task_status: { taskRef: `atk_${"0".repeat(32)}` },
  agent_task_cancel: { taskRef: `atk_${"0".repeat(32)}` },
  // Product mutation capabilities (registered since the product-mutation
  // change; kept in sync with the live tool surface — see manifest.lock.json).
  "products.createDraft": { name: "Fuzz draft product", category: "TEMPLATE", price: 100 },
  "products.update": { productId: "sim_prod_pub", description: "Fuzz update text." },
  "products.archive": { productId: "sim_prod_pub" },
  // Phase 9 — subscription governance tools.
  "subscriptions.plansList": {},
  "subscriptions.summary": {},
  "subscriptions.accessExplain": {},
  "subscriptions.trialStatus": {},
  "subscriptions.billingHistory": {},
  "subscriptions.freeEnroll": {},
  "subscriptions.trialStart": { planId: "sim_plan_alpha" },
  "subscriptions.cancelRequest": { subscriptionId: "sim_sub_alpha" },
}

describe("Phase 14 D — seeded fuzzing of every tool", () => {
  it("the fuzzed set is exactly the live tool surface", async () => {
    const h = await buildSimulationHarness()
    const o = await h.driver.execute({ kind: "list_tools", actor: ALPHA }, 0)
    expect(o.tools!.sort()).toEqual(Object.keys(BASES).sort())
  })

  it.each(Object.keys(BASES).map((t, i) => [t, i] as const))("%s survives %#-seeded hostile input with every invariant intact", async (toolName, i) => {
    const h = await buildSimulationHarness()
    const cases = fuzzCases(SEED + i, toolName, BASES[toolName], CASES_PER_TOOL)
    const observations: Observation[] = []
    for (const c of cases) {
      const actor = c.index % 2 === 0 ? ALPHA : BRAVO
      const args = JSON.parse(c.argsJson) as Record<string, unknown>
      let o: Observation
      try {
        o = await h.driver.execute({ kind: "tool", actor, name: toolName, args, meta: { [KEY]: `fuzz-${SEED}-${i}-${c.index}` } }, observations.length)
      } catch (err) {
        throw new Error(`gateway threw for seed=${c.seed} tool=${toolName} index=${c.index} strategy=${c.strategy}: ${String(err)}`)
      }
      observations.push(o)
      const def = toolName.startsWith("agent_task_") ? null : h.k.registry.get(toolName)
      if (!o.isError && def?.outputSchema) {
        expect(def.outputSchema.safeParse(o.output).success, `output contract seed=${c.seed} index=${c.index}`).toBe(true)
      }
    }
    await h.k.drain()
    const violations = checkInvariants(observations, await h.driver.snapshot(), { neverExecutable: NEVER_EXECUTABLE })
    // Reproduction detail: the case and what the agent saw (credential-shaped text masked).
    const detailed = violations.map((v) => ({ ...v, case: v.stepIndex !== undefined ? cases[v.stepIndex] : undefined, saw: v.stepIndex !== undefined ? scrubSecrets(observations[v.stepIndex].message ?? "").value.slice(0, 300) : undefined }))
    expect(detailed).toEqual([])
    // The fuzzer must actually exercise refusals (not only happy paths).
    expect(observations.some((o) => o.isError), toolName).toBe(true)
  })
})
