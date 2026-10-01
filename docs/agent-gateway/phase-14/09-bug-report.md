# Phase 14 — 09 Bug report

## Fixed

- P14-F1 (Medium): SDK-originated tool errors reflected agent input (`07-findings`). Fix: `lib/agent-gateway/mcp/tool-errors.ts`, installed per request in `mcp/server.ts`. The mechanism overrides the SDK's `createToolError` on the per-request `McpServer` instance; the SDK is exact-pinned (1.31.0) and `installStableToolErrors` throws if the hook disappears, so an upgrade cannot silently drop the protection.
- P14-F4 (test harness): per-test timeout raised to 30 s.

## Open at the end of Phase 14 (since resolved)

- P14-F2 (Low): approval requests / tasks for resources the agent does not own. Fixed after Phase 15 with a pre-approval ownership hook in the gate–adapter contract (`../known-issues-resolution.md`).
- P14-F3 (Info): binding-mismatch refusal also creates a pending approval for the altered input. Behaviour kept (the refusal names the new request); approval spam bounded by a per-connection pending limit (`../known-issues-resolution.md`).

## Pre-existing (carried; resolved after Phase 15)

PRE-12-1, PRE-13-1..3 and the feedback-route TS error are fixed (`../known-issues-resolution.md`); the ESLint baseline remains (120 problems).
