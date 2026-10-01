# Phase 12 — 05 Tool security

## Executable-only tool surface (changed in Phase 12)

`tools/list` now shows a capability only when it is agent-available (ACTIVE, `AGENT_AVAILABLE`) and executable (it has an `executionReference` and a registered adapter for that id and version): `projectTools(registry, adapters)` and `resolveProjectedTool(registry, name, adapters)`. The Phase 5 rule "listing ≠ executability" is retired, because listing an operation that can never execute let an agent create approval requests (human attention) and tasks for nothing (P12-B2, `11-bug-report`).

Call time re-checks the same rule, so an adapter that disappears after listing is refused (`CAPABILITY_NOT_FOUND`, no approval, no task). Registering an adapter is what makes a capability a tool; names are irrelevant.

The three task tools (`agent_task_submit`, `agent_task_status`, `agent_task_cancel`) are always listed; `agent_task_submit` applies the same executable check to the capability it names.

## Closed schemas

Every capability tool takes a strict object schema (unknown keys refused, including identity fields such as `ownerId`) and declares an output schema. Arguments are validated before the gate, with input hygiene (`03-prompt-injection`).

## Metadata cannot poison the agent

Names are the capability ids (`domain.action`, Phase 3 id rules). Titles and descriptions come from the reviewed manifest, are short, static, and are tested to contain no instruction-like text (the injection detector finds no signal in any of them). Results never modify metadata (`04-context-isolation`).

## Annotations

Derived from Phase 3 metadata (`toolAnnotationsFor`): `readOnlyHint` = READ, `destructiveHint` = non-read and IRREVERSIBLE, `idempotentHint` = IDEMPOTENT class, `openWorldHint` = false. They are hints for MCP clients and never a control; the gate decides.

## Pinned surface

The security-relevant summary of every core capability (exposure, status, operation type, adapter binding, schema shapes and bounds, strictness, content trust, identity context, idempotency, async, permission) is pinned in `capabilities/manifest.lock.json`; the fingerprint is recorded as ledger evidence when it changes (`09-supply-chain`).

## Proof

`p12-tool-security.test.ts` (8): exact tool list; unlisted capability not callable and creates nothing; adapter removed after listing refused; registering an adapter makes a tool; closed schemas + output schemas; unknown arguments refused before anything runs; clean static metadata; annotations. Updated earlier suites: `mcp-server-integration.test.ts` and `p7-end-to-end.test.ts` now register the adapters they exercise.
