# Phase 4 — Adapter Contract

## `AgentExecutionContext` (`contracts/execution-context.ts`)

Every field is either server-generated or copied verbatim from the Phase 2 `AgentMachineIdentity` — **never** read from a client-supplied body/header:

| Field | Source |
|---|---|
| `requestId` | Copied from the Phase 1 gateway request context |
| `connectionId`, `agentId`, `ownerId`, `teamId`, `connectionStatus` | Copied from `AgentGatewayRequestContext.machine` (Phase 2, already verified) |
| `capabilityId`, `capabilityVersion` | The resolved Phase 3 capability definition |
| `environment` | The AgentConnection's own recorded environment (never client-supplied) |
| `timestamp` | `new Date()` at context-build time |
| `signal` | Propagated from the Phase 1 gateway request's `AbortSignal` |
| `idempotencyKey` | Supplied by the caller (e.g. an HTTP header) when the capability requires one — never invented by this layer |
| `tracing` | A safe-to-log subset of the above, for `execution-log.ts` |

There is exactly ONE place this context is ever constructed: `resolver/build-execution-context.ts`'s `buildExecutionContext()`. It throws (`ExecutionError("FORBIDDEN", ...)`) if `gatewayContext.machine` is absent, rather than fabricating a fallback identity.

## `AgentCapabilityAdapter<TInput, TOutput>` (`contracts/adapter.ts`)

```ts
interface AgentCapabilityAdapter<TInput = unknown, TOutput = unknown> {
  readonly capabilityId: string
  readonly capabilityVersion: number
  execute(context: AgentExecutionContext, input: TInput): Promise<ExecutionResult<TOutput>>
}
```

- `capabilityId`/`capabilityVersion` are declared as literal readonly fields on each concrete class — `AdapterRegistry` checks these against its own storage key at registration time (see `04-existing-service-mapping.md`), and `hard-safety-checks.ts` checks them again at resolution time, as a structural guard against a mis-bound adapter.
- `execute()` receives `input` that has **already** been validated against the capability's Phase 3 `inputSchema` — the adapter's only remaining job is translation: turn `input` into the exact call the existing service expects, invoke that ONE service, translate its result, translate any thrown error into an `ExecutionError`.
- Every adapter's `execute()` checks `context.signal.aborted` before touching the database — see `08-async-execution.md` / cancellation section.

## `ExecutionResult<TOutput>` (`contracts/execution-result.ts`)

```ts
interface ExecutionResult<TOutput = unknown> {
  output: TOutput
  executionMode: "SYNC" | "ASYNC"
  taskReference?: string   // ASYNC only, from an EXISTING queue, never invented
  durationMs: number
}
```

The resolver — not the adapter — has the final say on whether `output` is acceptable: `AdapterResolver.execute()` re-validates `result.output` against the capability's own `outputSchema` after the adapter returns, replacing `result.output` with the parsed (and therefore contract-conformant) value. An adapter cannot smuggle an extra field into the result just by returning it.

## `ExecutionError` (`contracts/execution-error.ts`)

A dedicated error type, separate from Phase 3's `CapabilityError` and Phase 1's `GatewayError` (see `06-error-mapping.md` for the full translation table). Every adapter and the resolver itself throw **only** this type.

## Binding rules

1. An adapter's `capabilityId`/`capabilityVersion` must exactly match the `(id, version)` key it is registered under (`AdapterRegistry.register()` checked; `hard-safety-checks.ts` re-checked at resolution time).
2. There is no method anywhere in this module that accepts a client-suppliable adapter name/key and invokes it — the ONLY path to an adapter is `capabilityRegistry.resolve(ref)` -> `adapterRegistry.get(definition.id, definition.version)`.
3. An adapter never imports another adapter, never dynamically requires/imports a module by string, and never calls a service function whose name was constructed at runtime.
