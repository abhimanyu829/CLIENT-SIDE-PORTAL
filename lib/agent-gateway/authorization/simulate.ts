/**
 * lib/agent-gateway/authorization/simulate.ts
 *
 * `simulateAuthorization()` — an internal-only evaluation entry point
 * answering "given identity + capability + resource + environment +
 * policy, what is the decision?" without executing anything. Used by
 * this phase's own test suite and reserved for a FUTURE Phase 10
 * governance UI's "test this policy change" feature.
 *
 * NOT exposed to untrusted clients: this function is not registered as
 * an MCP tool, not reachable from any `app/api/agent-gateway/*` route,
 * and is not exported from any Phase 5 barrel. It is exported only from
 * this module's own file and from the authorization/index.ts barrel,
 * which nothing outside lib/agent-gateway/ and lib/agent-gateway/tests/
 * imports.
 */
import type { AuthorizationContext, AuthorizationDecision } from "./types"
import { evaluate } from "./engine"
import { loadActivePolicySet } from "./policy-store"

/**
 * Evaluates a given context against the CURRENTLY LIVE policy set (same
 * data source `PolicyEngineAuthorizer` uses). Read-only — never mutates
 * policy state, never executes a capability, never performs any side
 * effect beyond the policy-set read itself.
 */
export async function simulateAuthorization(context: AuthorizationContext): Promise<AuthorizationDecision> {
  const policySet = await loadActivePolicySet()
  return evaluate(context, { versions: policySet })
}
