/**
 * lib/agent-gateway/execution/contracts/adapter.ts
 *
 * `AgentCapabilityAdapter` — the ONLY execution interface Phase 4 defines.
 * There is no `GenericAdapter`, `UniversalAdapter`, `CrudAdapter`,
 * `HttpAdapter`, `PrismaAdapter`, or `SqlAdapter` anywhere in this module,
 * by design (explicitly forbidden). Every adapter is a small, named,
 * capability-specific class that calls exactly ONE existing business
 * service function — see each file under `execution/adapters/` for the
 * exact existing-service call each one makes.
 */
import type { AgentExecutionContext } from "./execution-context"
import type { ExecutionResult } from "./execution-result"

export interface AgentCapabilityAdapter<TInput = unknown, TOutput = unknown> {
  /** Must equal the capability id this adapter is bound to (e.g. "products.list"). Used by AdapterRegistry to detect a mismatched binding at registration time — never inferred, never guessed. */
  readonly capabilityId: string
  readonly capabilityVersion: number

  /**
   * Executes the capability. `input` has ALREADY been validated against
   * the capability's Phase 3 `inputSchema` by the resolver before this is
   * called — the adapter's job is only to translate `input` into the
   * exact call the existing service expects, invoke that ONE service,
   * translate its result into the capability's `outputSchema` shape, and
   * translate any thrown error into an `ExecutionError`.
   *
   * Must respect `context.signal` for cancellation and must never invoke
   * anything other than the one existing service this adapter is bound
   * to (no dynamic dispatch, no arbitrary function/module resolution).
   */
  execute(context: AgentExecutionContext, input: TInput): Promise<ExecutionResult<TOutput>>
}
