# Phase 6 — The Authorization Boundary (Replacing Phase 5's Placeholder)

## The exact one-line change

Phase 5 built the seam and documented exactly what Phase 6 needed to do (`docs/agent-gateway/phase-5/07-authorization-boundary.md`): replace the single `new FailClosedAuthorizer()` construction in `route-handler.ts` with a real `CapabilityAuthorizer` implementation. This phase does exactly that, and nothing more, in `lib/agent-gateway/mcp/route-handler.ts`:

```diff
- import { FailClosedAuthorizer } from "./authorization-hook"
+ import { PolicyEngineAuthorizer } from "../authorization/authorizer"

  const server = createMcpServerForRequest(
    {
      capabilityRegistry: getCapabilityRegistry(),
      adapterRegistry: getAdapterRegistry(),
-     authorizer: new FailClosedAuthorizer(),
+     authorizer: new PolicyEngineAuthorizer(),
    },
    ...
  )
```

No other line in `route-handler.ts`, and no line at all in `mcp/server.ts` or `mcp/authorization-hook.ts`, was touched. `FailClosedAuthorizer` and `AllowAllForTestingAuthorizer` (Phase 5's own classes) remain exactly as Phase 5 left them — `FailClosedAuthorizer` is still exported and still usable (e.g. as an emergency manual fallback), it is simply no longer the class `route-handler.ts` constructs.

## `PolicyEngineAuthorizer`'s own fail-closed guarantee

Critically, swapping the class does **not** weaken the production default, because `PolicyEngineAuthorizer.authorize()` itself never allows on an internal failure:

```ts
let decision
try {
  const policySet = await loadActivePolicySet()
  decision = evaluate(authzContext, { versions: policySet })
} catch {
  decision = { decision: "POLICY_UNAVAILABLE", reasonCode: "POLICY_UNAVAILABLE", message: "..." }
}
// ...
if (decision.decision === "ALLOW") return
throw toAuthorizationError(capability.id, decision)
```

Every path through this function either returns normally (a genuine `ALLOW` from a matched policy) or throws `AuthorizationDeniedError`. There is no `catch` block, no early return, and no default parameter anywhere in this class that could resolve to an implicit allow. This was verified directly by `authz-authorizer.test.ts`'s "POLICY_UNAVAILABLE fail-closed" test and the entire `authz-failure.test.ts` suite (database unavailable, policy lookup unavailable, malformed policy, incomplete policy set, evaluator exception — all six scenarios deny).

## Current production reality: authorized calls will succeed once configured

Unlike Phase 5's end state (where `FailClosedAuthorizer` denied literally every call unconditionally), Phase 6's `PolicyEngineAuthorizer` will **ALLOW** a call once a matching `AgentPolicy` exists — this is the intended, working authorization layer, not another placeholder. Verified end-to-end by `authz-end-to-end.test.ts`'s "allowed read" test: a real `tools/call` through the real MCP server, with a real seeded policy, succeeds and returns real adapter output.

**However**, as of this phase's completion, the real production database does not yet have the `AgentPolicy`/`AgentPolicyVersion` tables (the migration has not been applied — see `14-database-verification.md`), and even once it does, the table starts empty. Until an administrator applies the migration and creates at least one policy (e.g. via `seedBaselineReadPolicies()` or hand-authored rows), every real `tools/call` in production will resolve to `DEFAULT_DENY_NO_POLICY` (a normal deny, not a `POLICY_UNAVAILABLE` — the table exists and returns zero rows, which is a legitimately different, and correctly handled, state) or `POLICY_UNAVAILABLE` (if the table doesn't exist at all yet, which throws a real Postgres error caught by the try/catch above). Either way, the system remains safe; it is simply not yet *useful* until an administrator takes the (deliberately human-only) step of authoring policy.

## Phase 7 boundary, restated

`REQUIRES_APPROVAL` is a decision this engine can emit (per the spec's explicit allowance — "Phase 6 may emit REQUIRES_APPROVAL as a policy result, but MUST NOT execute an approval workflow"), and `PolicyEngineAuthorizer` enforces it identically to a deny today, since no approval-workflow executor exists yet. When Phase 7 is eventually built, it can consume this exact decision (and its `matchedPolicyId`/`matchedPolicyVersionId` tracing fields) as its own trigger — no change to `engine.ts`, `precedence.ts`, or the policy model is anticipated to be needed for that integration, though this is a forward-looking note, not a promise about unbuilt work.
