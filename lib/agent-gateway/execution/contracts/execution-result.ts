/**
 * lib/agent-gateway/execution/contracts/execution-result.ts
 *
 * The normalized shape every adapter execution resolves to. Adapters
 * never return the raw existing-service result — they return an
 * `ExecutionResult<TOutput>` whose `output` has already been mapped
 * through the capability's own `outputSchema` (Phase 3) by the resolver,
 * never by the adapter deciding on its own what's safe to return.
 */

export interface ExecutionResult<TOutput = unknown> {
  output: TOutput
  /** "SYNC" for anything that completed inline; "ASYNC" only for a capability whose Phase 3 metadata already declares async execution AND whose adapter returned a task reference from an EXISTING queue/worker entry point. */
  executionMode: "SYNC" | "ASYNC"
  /** Present only for ASYNC executions — an opaque reference from the EXISTING job/queue system, never a newly invented task-state model. */
  taskReference?: string
  durationMs: number
}
