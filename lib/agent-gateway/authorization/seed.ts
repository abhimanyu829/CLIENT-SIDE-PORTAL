/**
 * lib/agent-gateway/authorization/seed.ts
 *
 * OPTIONAL, EXPLICIT-INVOCATION-ONLY bootstrap of a minimal baseline
 * policy set, so the deny-by-default engine has SOMETHING to evaluate
 * against out of the box rather than requiring a human to hand-author
 * every policy via direct DB access before the gateway is useful at all.
 *
 * This is NOT run automatically at module import, NOT wired into any
 * singleton getter, NOT reachable from any API route, and NOT an agent
 * capability — it is a plain exported function, analogous to a one-time
 * setup script, meant to be invoked explicitly (e.g. from a future
 * Phase 10 admin action, or manually via a one-off script) by an
 * ALREADY-authorized human administrator. Calling it is itself the human
 * authorization event the spec requires ("An administrator creating or
 * changing an agent policy is a HUMAN authorization event").
 *
 * The seeded policies are DELIBERATELY conservative: they allow only the
 * READ-tier capabilities Phase 3/4 already registered adapters for
 * (products.list, products.get, subscriptions.get, tickets.list), scoped
 * to GLOBAL (any owner/connection may read), and explicitly do NOT allow
 * any LOW_RISK_WRITE/HIGH_RISK_MUTATION/CRITICAL capability — a real
 * administrator must consciously author a policy for anything beyond
 * READ. This mirrors Phase 3's own "one representative capability per
 * risk tier, describing but not enabling everything" caution.
 */
import { createPolicyVersion } from "./policy-store"

const SEED_ALLOWED_READ_CAPABILITIES = ["products.list", "products.get", "subscriptions.get", "tickets.list"]

export interface SeedResult {
  policyId: string
  policyVersionId: string
  capabilityId: string
}

/**
 * Idempotent in effect (not in mechanism): calling this twice creates two
 * new AgentPolicy rows with new versions, rather than erroring — but
 * since each seeded policy always ALLOWs the exact same narrow, harmless
 * READ capability set, running it twice has no meaningful security effect
 * (the resulting policy SET still only ever allows the same 4 read
 * capabilities). It is not literally idempotent at the DB-row level
 * (createPolicyVersion always creates new rows) — this is documented
 * rather than silently assumed.
 */
export async function seedBaselineReadPolicies(actorId: string): Promise<SeedResult[]> {
  const results: SeedResult[] = []
  for (const capabilityId of SEED_ALLOWED_READ_CAPABILITIES) {
    const created = await createPolicyVersion({
      name: `Baseline read access — ${capabilityId}`,
      description: `Seeded baseline policy allowing any authenticated, ACTIVE connection to invoke the READ-tier capability "${capabilityId}". Deliberately narrow — see seed.ts's module doc for rationale.`,
      enabled: true,
      priority: 0,
      effect: "ALLOW",
      scope: "CAPABILITY",
      capabilityId,
      conditions: null,
      riskConstraint: "READ",
      approvalRequirement: false,
      note: "Created by seedBaselineReadPolicies() — Phase 6 bootstrap.",
      actorId,
    })
    results.push({ policyId: created.policyId, policyVersionId: created.policyVersionId, capabilityId })
  }
  return results
}
