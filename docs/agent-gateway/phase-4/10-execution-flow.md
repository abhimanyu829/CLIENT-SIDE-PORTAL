# Phase 4 — Execution Flow (Representative Trace)

## Example: `products.get` for a real AI caller

```
1. External AI platform sends an authenticated request through Phase 1's
   Agent Gateway (out of Phase 4's scope — already built).

2. Phase 1 verifies the bearer token / signed request, resolves the
   AgentConnection + AgentCredential (Phase 2), and builds
   AgentGatewayRequestContext { machine: { connectionId, ownerId, ... } }.

3. AdapterResolver.execute("products.get", { id: "prod_123" }, gatewayContext)
   is called (by whatever future caller invokes it — Phase 5's MCP server,
   or a test).

4. resolveExecutionTarget():
     - capabilityRegistry.resolve("products.get") -> the Phase 3 definition
       (version 1, exposure AGENT_AVAILABLE, status ACTIVE).
     - exposure check passes (AGENT_AVAILABLE).
     - status check passes (ACTIVE).
     - adapterRegistry.get("products.get", 1) -> ProductsGetAdapter instance.
     - binding check passes (adapter.capabilityId === "products.get").
     - gatewayContext.machine is present and connectionStatus === "ACTIVE".

5. capabilityRegistry.validateInput("products.get@v1", { id: "prod_123" })
   -> zod .strict() schema passes -> { id: "prod_123" }.

6. Connection environment ("production", say) is fetched via
   getAgentConnectionService().getById(connectionId) and compared against
   getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT ("production") -> match.

7. checkIdempotency(): products.get doesn't require a key -> NOT_REQUIRED,
   proceeds immediately.

8. buildExecutionContext(): AgentExecutionContext assembled from
   gatewayContext.machine ONLY (ownerId, connectionId, connectionStatus) +
   server-generated fields (requestId, timestamp, signal).

9. ProductsGetAdapter.execute(context, { id: "prod_123" }):
     - context.signal.aborted is false -> proceeds.
     - db.product.findUnique({ where: { id: "prod_123" }, select: {...} })
       -- the SAME Prisma model access app/api/products/[slug]/route.ts
       uses, just keyed by id instead of slug.
     - Row found -> { output: { id, name, slug, status, type }, ... }.

10. Resolver re-validates result.output against the capability's own
    outputSchema (productSummarySchema) -- passes, since the adapter's
    select already matches it exactly.

11. recordExecutionEvent(): a safe, field-allowlisted log line is emitted
    via the EXISTING Phase 1 pino logger (agent_gateway_capability_executed).

12. ExecutionResult<ProductSummary> is returned to the caller.
```

## What did NOT happen anywhere in this trace

- No new database write.
- No new event emission beyond the existing observability log line (there is nothing to emit for a pure read — the real `[slug]/route.ts` route's own `viewCount` increment was deliberately NOT replicated, per `04-existing-service-mapping.md`).
- No cache invalidation (nothing was mutated).
- No UI revalidation call (nothing was mutated) — see `14-ui-consistency-report.md` for why this is correct for READ capabilities specifically, and what a future WRITE-capability adapter would need to preserve.

## Example: a BLOCKED capability — `products.createDraft`

```
1-2. Same as above (Phase 1/2 already verified the caller).

3. AdapterResolver.execute("products.createDraft", { name: "X", ... }, ctx).

4. resolveExecutionTarget():
     - capabilityRegistry.resolve("products.createDraft") -> found,
       exposure AGENT_AVAILABLE, status ACTIVE (Phase 3 correctly
       describes this capability as agent-available in principle).
     - adapterRegistry.get("products.createDraft", 1) -> null
       (no adapter was ever registered -- see 04-existing-service-mapping.md).

5. ADAPTER_NOT_FOUND is thrown immediately. The real createProduct Server
   Action, requireAdmin(), the Product table, and every downstream event/
   revalidation mechanism are NEVER touched.
```

This is the correct, intended outcome for a capability the Step 0 audit found no safe execution path for — not a bug, and not silently "worked around" by faking an admin session.
