/**
 * lib/agent-gateway/execution/resolver/adapter-registry.ts
 *
 * The store of concrete `AgentCapabilityAdapter` instances, keyed by the
 * SAME `id@vN` storage key Phase 3's `CapabilityRegistry` uses. This is
 * deliberately a separate registry from the capability registry — Phase 3
 * describes WHAT a capability is; this registry says WHICH concrete
 * adapter object executes it. Keeping them separate means Phase 3 never
 * needs to import any adapter code (no circular dependency, no coupling
 * of the description layer to the execution layer).
 *
 * `register()` is a trusted, module-init-time-only operation — the same
 * trust boundary as Phase 3's `CapabilityRegistry.register()`. It is
 * never reachable from a request handler.
 */
import { storageKey } from "../../capabilities/id"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import { ExecutionError } from "../contracts/execution-error"

export class AdapterRegistry {
  private readonly adapters = new Map<string, AgentCapabilityAdapter>()

  /**
   * Registers one adapter. Rejects (throws `ExecutionError`, never
   * silently ignores):
   *   - a duplicate registration for the same (capabilityId, version)
   *   - an adapter whose own `capabilityId`/`capabilityVersion` fields
   *     don't match the key it's being registered under (a structural
   *     guard against a copy-pasted adapter accidentally bound to the
   *     wrong capability)
   */
  register(adapter: AgentCapabilityAdapter): void {
    const key = storageKey(adapter.capabilityId, adapter.capabilityVersion)
    if (this.adapters.has(key)) {
      throw new ExecutionError(
        "CONFLICT",
        `An adapter for "${key}" is already registered. Duplicate adapter registration is rejected.`
      )
    }
    this.adapters.set(key, adapter)
  }

  /** Returns the registered adapter for (capabilityId, version), or null if none exists. Never throws — callers (the resolver) decide how to react to a missing adapter. */
  get(capabilityId: string, version: number): AgentCapabilityAdapter | null {
    return this.adapters.get(storageKey(capabilityId, version)) ?? null
  }

  has(capabilityId: string, version: number): boolean {
    return this.adapters.has(storageKey(capabilityId, version))
  }
}
