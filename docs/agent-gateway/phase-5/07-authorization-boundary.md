# Phase 5 — Phase 6 Authorization Boundary

## What Phase 5 builds here, and what it deliberately does not

Phase 5's job is to build the clean integration point Phase 6 will later fill in — nothing more. This phase explicitly does **not** implement: ABAC, a policy engine, human-in-the-loop approval flows, autonomy levels/tiers, spend/rate budgets, per-capability governance rules, or any notion of "trust score." All of that is out of scope per the master prompt's "Phase 5 must not implement" list, and none of it exists anywhere in `lib/agent-gateway/mcp/`.

## The interface (`authorization-hook.ts`)

```ts
interface CapabilityAuthorizer {
  authorize(
    context: AgentExecutionContext,
    capability: CapabilityDefinition,
    input: unknown,
    resourceContext: ResourceContext
  ): Promise<void>
}
```

Deliberately **throw-to-deny**, never boolean-return-to-deny. A boolean-returning `authorize(): Promise<boolean>` has a well-known failure mode: a caller that forgets to check the return value silently proceeds as if authorized. A throw-to-deny contract cannot be "forgotten" — an uncaught deny always propagates as an exception, and `mcp/server.ts`'s call site explicitly catches only `AuthorizationDeniedError` and converts it to a denial response; every other exception type propagates to the generic error handler, so a bug in a future Phase 6 authorizer that throws something else still fails the call (safely) rather than silently allowing it.

## Where it's called

Exactly once per `tools/call`, inside the tool's registered callback in `mcp/server.ts`, **after** the tool is re-resolved (so a disabled capability never reaches the authorizer at all) and **before** `AdapterResolver.execute()` is ever invoked. No adapter, no Prisma call, no Phase 4 code runs before this hook has resolved without throwing.

## Production default: `FailClosedAuthorizer`

```ts
class FailClosedAuthorizer implements CapabilityAuthorizer {
  async authorize(_context, capability, _input, _resourceContext): Promise<void> {
    throw new AuthorizationDeniedError(`Capability "${capability.id}" execution requires an authorization decision, and no authorization subsystem is configured. Failing closed.`)
  }
}
```

This is wired unconditionally in `route-handler.ts`'s production call to `createMcpServerForRequest()`. Every single `tools/call` in production today is denied, regardless of capability, risk tier, or requester — including plain reads like `products.list`. This is intentional and spec-mandated ("Do NOT default to unrestricted execution simply because Phase 6 doesn't exist yet"), verified end-to-end by `mcp-route-handler.test.ts`'s "full pipeline: authenticated tools/call... returns... AUTHORIZATION_DENIED" and by `mcp-server-integration.test.ts`'s dedicated `FailClosedAuthorizer` test.

**Practical consequence, stated plainly**: as of the end of Phase 5, the MCP endpoint is fully wired, fully tested, and fully deployable, but zero external AI platform can successfully execute any tool through it yet. `tools/list` works (an external platform can discover what's available). `tools/call` always returns `AUTHORIZATION_DENIED` until Phase 6 replaces `FailClosedAuthorizer` with a real policy decision. This is the correct, safe state for a Phase 5 deliverable — the alternative (defaulting to allow) would mean the very first real MCP connection could execute any of the 4 already-adapted capabilities with no policy check at all.

## Test-only counterpart: `AllowAllForTestingAuthorizer`

Exists solely so Phase 5's own integration tests can exercise the tool-projection → resolver → adapter path without every single test asserting `AUTHORIZATION_DENIED`. It is:
- Named unambiguously (`AllowAllForTestingAuthorizer`, not `DefaultAuthorizer` or similar) so a grep for `Authorizer` or a code review immediately flags its purpose.
- Never imported by any file under `lib/agent-gateway/mcp/`, `app/api/agent-gateway/`, or any other production path — confirmed by `grep_search` for its import across the codebase during this phase's own audit; the only importers are test files.
- Not exported from `mcp/index.ts`'s barrel in a way that implies production use (it is exported from `authorization-hook.ts` directly, alongside `FailClosedAuthorizer`, exactly the way Phase 3/4 export their own test-support helpers).

## What Phase 6 will need to do (forward-looking, not built here)

Replace the single `new FailClosedAuthorizer()` construction in `route-handler.ts` with a real implementation of `CapabilityAuthorizer` — e.g. one backed by a policy table keyed by `(ownerId, capability.id, capability.riskTier)`, or an approval-queue lookup for `HIGH_RISK`/`CRITICAL` capabilities. Phase 6 does not need to touch `mcp/server.ts`, `mcp/route-handler.ts`, or any tool registration logic — the `authorize()` call site, its four parameters (`context`, `capability`, `input`, `resourceContext`), and its throw-to-deny contract are already exactly what a real policy engine needs to make a decision. `ResourceContext.resourceId` is left present but unpopulated by Phase 5 (informational placeholder only) since no Phase 5 capability's authorization decision needs a specific resource id yet — Phase 6 owns deciding whether/how to populate and interpret it.
