# Phase 12 — 11 Bug report

## Bugs discovered and fixed in Phase 12

| Id | Severity | Bug | Found by | Fix |
|---|---|---|---|---|
| P12-B1 | Medium | The approval display summary scrubbed secret-shaped values in the input but showed the agent-supplied `resourceId` unscrubbed, so a token placed in a resource id reached the approver's screen and the governance views. | `p12-injection` B5 | `approvals/redaction.ts` scrubs `resourceId`; governance views scrub agent-supplied strings (`agentStr`). |
| P12-B2 | Medium | Capabilities without a registered adapter were listed in `tools/list` and callable by name: an agent could create approval requests and tasks for operations that can never execute (approver fatigue, queue noise). | `p12-tool-security` | Executable-only projection (`projectTools` / `resolveProjectedTool` with the adapter registry), re-checked at call time and in `agent_task_submit`. |
| P12-B3 | Medium | `products.get` returned DRAFT and ARCHIVED products to agents (unpublished vendor content, pre-launch pricing). | `p12-exfiltration` | The adapter serves AVAILABLE products only; others are `RESOURCE_NOT_FOUND`, indistinguishable from missing. |
| P12-B4 | Low | Three gateway routes (`/api/agent-gateway`, `/mcp`, `/health`) did not declare `dynamic = "force-dynamic"`, unlike every governance route, and all three were part of the build's static-generation pass (244 entries before, 241 after the fix; the health handler takes no request, so it was a prerender candidate). | `p12-supply-chain` | `export const dynamic = "force-dynamic"` on all three; the build now lists them as `ƒ` (dynamic). |


## Findings that needed no fix

- F-1: on the MCP path the SDK parses tool arguments with Zod v3 before the gateway callback, and Zod drops a `__proto__` key, so the registry's `PROTOTYPE_KEY` refusal does not fire there; the key never reaches the gate, an approval summary, a task or storage, and nothing is polluted (proven in `p12-injection` B4). Direct registry callers (task engine, triggers, recovery) are refused by the registry check.

## Test-harness issues fixed (not product bugs)

- `p12-secrets` needed the DB credential store (`tests/setup.ts` pins the Phase 1 env store) — stubbed `AGENT_GATEWAY_CREDENTIAL_STORE=db` inside the test.
- The first dependency scan matched `from "…"` inside comments; it now parses module statements only and asserts it sees known dependencies (so it cannot pass vacuously).
- `mcp-server-integration` and `p7-end-to-end` listed adapter-less tools; they now register the adapters (or a recording stub) they exercise, as the executable-only rule requires.

## Pre-existing, not fixed (out of the agent surface)

> Update: PRE-12-1 and the feedback-route TypeScript error were fixed after Phase 15 (`../known-issues-resolution.md`).

- PRE-12-1: the human route `/api/products/[slug]` returns products of any status. Not reachable by agents; changing it would alter the human storefront contract (protected system). Recommended follow-up for the product owner.
- `app/api/feedback/route.ts(128,11)` TS2322 and the ESLint baseline (122 problems) — unchanged.
