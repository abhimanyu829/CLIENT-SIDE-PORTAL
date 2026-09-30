/**
 * lib/agent-gateway/mcp/tool-projection.ts
 *
 * Projects Phase 3 `CapabilityDefinition`s onto MCP tools. Phase 3
 * remains the sole source of truth for id/version/schema/risk/exposure
 * metadata — this module does not redefine any capability's contract, it
 * only decides WHICH capabilities become MCP-visible and how their
 * existing Phase 3 id/schemas map onto the MCP `Tool` shape.
 *
 * Capability existence != MCP exposure (spec's explicit requirement):
 * only `status: "ACTIVE"` AND `exposure: "AGENT_AVAILABLE"` capabilities
 * are ever projected. `DISABLED`, `DEPRECATED`, `INTERNAL_ONLY`, and
 * `FORBIDDEN` capabilities are never listed and never callable through
 * this layer, regardless of whether a Phase 4 adapter happens to exist
 * for them.
 */
import type { CapabilityRegistry } from "../capabilities/registry"
import type { CapabilityDefinition } from "../capabilities/types"

export interface ProjectedTool {
  /** Deterministic, stable, collision-safe: the capability's own id (already unique) plus its version. Matches "products.get" style naming — never "prisma.product.update" or similar implementation-detail names, since Phase 3's id.ts already enforces this format. */
  name: string
  title: string
  description: string
  capability: CapabilityDefinition
}

/** MCP tool names must be non-empty, reasonably short identifiers. Phase 3's `id.ts` already enforces `domain.action` (<=80 chars, no unsafe characters) — this reuses that guarantee rather than re-validating it, since the name IS the capability id. */
export function toolNameFor(capability: CapabilityDefinition): string {
  return capability.id
}

/**
 * Returns the deterministic, ordered list of tools to expose — ONE tool
 * per distinct capability id, never one row per registered VERSION.
 *
 * `registry.list()` returns every registered (id, version) row — if a
 * capability has two registered versions and both happen to be
 * `AGENT_AVAILABLE`/`ACTIVE`, naively projecting `list()` 1:1 would
 * attempt to register the SAME MCP tool name twice (tool names are the
 * bare capability id, not `id@vN` — see `03-tool-naming.md`), which is a
 * genuine collision, not just a cosmetic duplicate. To avoid it, this
 * function collapses to each distinct id's `resolve()`d definition
 * (Phase 3's own deterministic "highest non-deprecated version" rule),
 * deduplicating in first-seen (insertion) order so overall ordering
 * still matches `list()`'s deterministic order.
 */
export function projectTools(registry: CapabilityRegistry): ProjectedTool[] {
  const seenIds = new Set<string>()
  const tools: ProjectedTool[] = []

  for (const row of registry.list()) {
    // DISABLED/FORBIDDEN already excluded by Phase 3's own default list().
    if (seenIds.has(row.id)) continue
    seenIds.add(row.id)

    // Resolve THIS id's current definition (may differ from `row` if `row`
    // was a non-default/deprecated version encountered first in insertion
    // order) — resolve() always returns the same, deterministic "current"
    // version regardless of which row of that id we started from.
    const capability = registry.get(row.id)
    if (!capability) continue // fully disabled/absent by the time we resolved it
    if (capability.exposure !== "AGENT_AVAILABLE" || capability.status !== "ACTIVE") continue

    tools.push({ name: toolNameFor(capability), title: capability.name, description: capability.description, capability })
  }

  return tools
}

/**
 * Looks up a single tool's backing capability, applying the exact same
 * exposure/status filter as `projectTools()` — a tool name that exists in
 * the registry but is not currently MCP-exposed (e.g. it was disabled
 * after the last `tools/list` call, or is `INTERNAL_ONLY`) must resolve
 * to "not found" here, not fall through to execution.
 */
export function resolveProjectedTool(registry: CapabilityRegistry, name: string): ProjectedTool | null {
  const capability = registry.get(name)
  if (!capability) return null
  if (capability.exposure !== "AGENT_AVAILABLE" || capability.status !== "ACTIVE") return null
  return { name: toolNameFor(capability), title: capability.name, description: capability.description, capability }
}
