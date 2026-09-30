# Phase 5 — Tools Architecture (projection, naming, schemas)

## One tool per capability, never a generic dispatcher

There is no `execute_capability(name, args)` catch-all tool. Each Phase-3-exposed capability becomes its own named MCP tool, registered individually via `server.registerTool()` in `mcp/server.ts`. This mirrors Phase 4's own "no generic execution mechanism" rule (`docs/agent-gateway/phase-4/09-security-boundary.md`) at the protocol layer: an external AI platform's tool-calling model sees `products.get`, `subscriptions.get`, etc., never a single arbitrary-string-accepting tool that could be steered toward an unintended capability id.

## Exposure filter (`tool-projection.ts`)

A capability is projected as an MCP tool if and only if:

- `capability.exposure === "AGENT_AVAILABLE"`, and
- `capability.status === "ACTIVE"`.

`DISABLED`, `DEPRECATED`, `INTERNAL_ONLY`, and `FORBIDDEN` capabilities are never listed and never resolve at call time either — `resolveProjectedTool()` applies the identical filter, so a capability disabled *between* a `tools/list` and a later `tools/call` is correctly rejected rather than executed on stale information (verified by `mcp-server-integration.test.ts` #16 and `mcp-tool-projection.test.ts` #16/#17).

Note the deliberate distinction Phase 5 preserves: **listing does not imply executability**. `products.createDraft` and `coupons.create` are `AGENT_AVAILABLE`/`ACTIVE` per Phase 3's manifest and so ARE listed, but Phase 4 registered no adapter for either (see Phase 4's `12-bug-report.md` — blocked on `requireAdmin()`'s lack of a service-principal mechanism). Calling them yields a clean `ADAPTER_NOT_FOUND` from the resolver, never a crash or a fallback to some generic execution path. Verified by `mcp-server-integration.test.ts`: "a listed-but-unadaptered tool... fails ADAPTER_NOT_FOUND on tools/call."

## Tool naming

`toolNameFor(capability)` returns the capability's own `id` unchanged (e.g. `"products.get"`). Phase 3's `capabilities/id.ts` already enforces the `domain.action` format (lowercase, dot-separated, bounded length, no unsafe characters) — Phase 5 reuses that guarantee rather than re-validating or inventing a translation layer (no `"prisma.product.update"`-style implementation-detail names, no hashing, no namespacing prefix). The tool name IS the capability id; there is exactly one name per exposed capability, enforced by the dedup-by-id logic below.

## Version collapsing (the one real bug this phase found — see `12-bug-report.md`)

`CapabilityRegistry.list()` returns one row per registered `(id, version)` pair. Naively projecting every row 1:1 would attempt to register the same MCP tool name twice if a capability ever had two `AGENT_AVAILABLE`/`ACTIVE` versions simultaneously — a genuine SDK-level collision, not a cosmetic duplicate, since MCP tool names are bare capability ids, not `id@vN`.

`projectTools()` avoids this by: collecting distinct ids in first-seen (insertion) order, then resolving each id through `registry.get()` — Phase 3's own deterministic "current version" rule (highest non-deprecated version) — rather than trusting whichever row happened to appear first in `list()`. This guarantees the projected tool always reflects Phase 3's canonical current version, verified by `mcp-tool-projection.test.ts` #18 ("capability-version mapping... carries the exact resolved version").

## Descriptions are not attacker-controllable

Every tool's `title`/`description` field passed to the SDK comes verbatim from Phase 3's own `capability.name`/`capability.description` — static strings defined in the Phase 3 manifest (`capabilities/manifest.ts`), never built by concatenating any request-time or client-supplied value. There is no prompt-injection surface here: nothing in this phase constructs a tool description from user input, connection metadata, or capability arguments.

## Input/output schemas

`inputSchema`/`outputSchema` passed to `server.registerTool()` are Phase 3's own zod schemas (`capability.inputSchema`/`capability.outputSchema`), passed straight through with no redefinition, narrowing, or widening in this layer. The MCP SDK converts them to JSON Schema for `tools/list` clients; validation of actual call arguments still happens where it always has — inside Phase 4's resolver, which re-parses input against the same Phase 3 schema before ever reaching an adapter (see Phase 4's `05-input-output-contracts.md`). Phase 5 does not add a second, competing validation layer.

## Tools/list pagination

`AGENT_GATEWAY_MCP_MAX_TOOLS_PER_PAGE` (default 100) bounds `tools/list` page size. This is a descriptive limit, not a security control — the Phase 3 manifest is currently 6 capabilities, far under the default. Documented here rather than treated as load-bearing.

## Tools/call execution path (see also `06-execution-flow.md`)

1. Re-resolve the tool by name at call time (not from the earlier `tools/list` snapshot) — closes the disable-after-list race.
2. Build an `AgentExecutionContext` from the already-verified `gatewayContext.machine` identity (never from call arguments).
3. Invoke the Phase 6 authorization hook (`CapabilityAuthorizer.authorize()`) — throws to deny, see `07-authorization-boundary.md`.
4. Invoke Phase 4's `AdapterResolver.execute()` — the same resolver the plain HTTP gateway endpoint uses, unmodified.
5. Wrap the adapter's normalized output as both a `structuredContent` object and a JSON-stringified text content block (for clients that only read the text form), with `isError: false`.
6. Any thrown error, from any of the above steps, is converted through `toMcpSafeError()` into a categorized, safe `CallToolResult` with `isError: true` — never a raw exception, never a partial/successful-looking result.
