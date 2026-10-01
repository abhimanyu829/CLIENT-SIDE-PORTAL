# Phase 15 — 10 Bug report

## Discovered and fixed

| Id | Severity | Found by | Bug | Fix |
|---|---|---|---|---|
| P15-B1 | Medium | master S20 | The promotion guard counted connection security events only when the ledger row carried the environment, but input-hygiene evidence (`security.input_rejected`) is recorded before an environment is resolved, so a connection that had just sent hidden characters could be promoted. | Security events are counted by connection alone (`rollout/health-gates.ts`). |
| P15-B2 | Low | final E2E step 18 | With every capability hidden (GLOBAL kill switch, nothing released) and task tools off, the per-request MCP server had no tool registered, so the SDK never installed its tools handlers: `tools/list` and `tools/call` failed with JSON-RPC "method not found" instead of an empty list and a stable refusal. | `mcp/server.ts` installs an empty `tools/list` and a `CAPABILITY_NOT_FOUND` `tools/call` handler when no tool is exposed. |
| P15-B3 | Info | review | Promotion failure codes were double-prefixed for an unavailable health store (`HEALTH_HEALTH_DATA_UNAVAILABLE`). | Prefix only once. |

## Pre-existing (carried, outside the agent surface)

PRE-12-1 (human product route serves any status), PRE-13-1 (ticket routes leak internal notes; nonexistent admin roles), PRE-13-2 (unchecked `projectId`), PRE-13-3 (unvalidated enums), the feedback-route TypeScript error, the ESLint baseline (122). All but the ESLint baseline (now 120) were fixed after Phase 15: `../known-issues-resolution.md`.

## Open findings (carried from Phase 14)

P14-F2, P14-F3 (`../phase-14/07-findings.md`); both resolved after Phase 15 (`../known-issues-resolution.md`).
