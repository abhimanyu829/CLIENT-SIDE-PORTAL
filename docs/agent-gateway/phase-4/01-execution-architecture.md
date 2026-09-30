# Phase 4 — Execution Architecture

Status: IMPLEMENTED. Additive only — no existing route, action, or business service was modified. This phase adds a thin execution bridge; it introduces zero new business logic.

## 1. What this phase is

The secure execution bridge between Phase 3's capability descriptions and the EXISTING business services that actually implement them:

```
EXTERNAL AI PLATFORM
        |
Phase 1 Agent Gateway
        |
Phase 2 Machine Identity
        |
Phase 3 Capability Registry
        |
PHASE 4 EXECUTION ADAPTER      <-- this phase
        |
EXISTING BUSINESS SERVICE
        |
DATABASE / QUEUE / EVENTS / REVALIDATION / UI
```

Core principle, upheld throughout: **existing business services are the source of truth**. No adapter duplicates pricing, payment, subscription, or deployment logic. No adapter creates an alternate database mutation path.

## 2. Module location

`lib/agent-gateway/execution/` — a new sibling module to Phase 1-3's `auth/`, `identity/`, `capabilities/`, following the exact directory-per-concern convention already established.

| Directory/file | Purpose |
|---|---|
| `contracts/execution-context.ts` | `AgentExecutionContext` — the trusted context passed to every adapter |
| `contracts/execution-error.ts` | `ExecutionError` — the execution-layer error contract |
| `contracts/execution-result.ts` | `ExecutionResult<T>` — the normalized result shape |
| `contracts/adapter.ts` | `AgentCapabilityAdapter<TInput,TOutput>` — the ONE adapter interface |
| `resolver/adapter-registry.ts` | `AdapterRegistry` — stores concrete adapter instances |
| `resolver/build-execution-context.ts` | The ONE place a context is ever assembled |
| `resolver/hard-safety-checks.ts` | The 9 structural safety checks |
| `resolver/adapter-resolver.ts` | `AdapterResolver` — orchestrates the full execution flow |
| `idempotency/idempotency-guard.ts` | Idempotency enforcement, reusing Phase 3 metadata + Phase 1's Redis client |
| `observability/execution-log.ts` | Execution logging, reusing Phase 1's pino logger |
| `adapters/*.ts` | The 4 concrete adapters, one per executable capability |
| `adapters/index.ts` | `registerCoreAdapters()` — the adapter manifest |
| `index.ts` | Singleton accessors + public re-exports |

## 3. Explicitly forbidden abstractions — none exist in this codebase

Per the spec's hard prohibition, this module contains **no** `GenericAdapter`, `UniversalAdapter`, `CrudAdapter`, `HttpAdapter`, `PrismaAdapter`, or `SqlAdapter`. Every adapter is a small, named, capability-specific class (`ProductsListAdapter`, `ProductsGetAdapter`, `SubscriptionsGetAdapter`, `TicketsListAdapter`) that calls exactly one existing service.

## 4. Execution flow (one request, start to finish)

```
capabilityRef, rawInput, gatewayContext
        |
        v
AdapterResolver.execute()
        |
   1. resolveExecutionTarget()   -- checks 1-5, 8, 9 (see 09-security-boundary.md)
        |
   2. capabilityRegistry.validateInput()  -- check 6, Phase 3's OWN validator, never reimplemented
        |
   3. assertEnvironmentMatches()  -- check 7
        |
   4. checkIdempotency()          -- Phase 3 metadata-driven
        |
   5. buildExecutionContext()     -- trusted context, Phase 2 identity ONLY
        |
   6. adapter.execute(context, validatedInput)  -- the ONE bound existing service is called here
        |
   7. outputSchema.safeParse(result.output)     -- resolver re-verifies the adapter's own claim
        |
   8. recordIdempotencyResult() (if new key)
        |
   9. recordExecutionEvent()      -- safe-fields-only observability
        |
        v
ExecutionResult<TOutput>
```

Every step fails closed — a rejection at any step throws a stable `ExecutionError` and the pipeline never proceeds past it.

## 5. Relationship to Phase 1/2/3

- **Phase 1** (`GatewayError`): a deliberately separate error contract. Phase 4 does not surface `GatewayError` — it surfaces `ExecutionError`, since execution has no HTTP transport concerns of its own in this phase.
- **Phase 2** (`AgentMachineIdentity`): the ONLY source of `ownerId`/`teamId`/`connectionId` inside `AgentExecutionContext` — see `build-execution-context.ts`.
- **Phase 3** (`CapabilityRegistry`): the resolver calls `capabilityRegistry.resolve()` and `capabilityRegistry.validateInput()` directly — Phase 4 never reimplements schema validation or capability lookup.

## 6. No HTTP surface added

Same as Phase 3: there is no new API route, no MCP server, no public discovery endpoint. `AdapterResolver` is a plain internal library class, consumed only by direct import (by a future Phase 5 MCP server, or by tests). This kept Phase 4's diff to zero new routes and zero new database migrations.
