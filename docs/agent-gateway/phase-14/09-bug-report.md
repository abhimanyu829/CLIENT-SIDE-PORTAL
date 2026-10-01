# Phase 14 — 09 Bug report

## Fixed

- P14-F1 (Medium): SDK-originated tool errors reflected agent input (`07-findings`). Fix: `lib/agent-gateway/mcp/tool-errors.ts`, installed per request in `mcp/server.ts`. The mechanism overrides the SDK's `createToolError` on the per-request `McpServer` instance; the SDK is exact-pinned (1.31.0) and `installStableToolErrors` throws if the hook disappears, so an upgrade cannot silently drop the protection.
- P14-F4 (test harness): per-test timeout raised to 30 s.

## Open (documented, not fixed in Phase 14)

- P14-F2 (Low): approval requests / tasks for resources the agent does not own. Fixing it needs a new pre-approval ownership hook in the gate–adapter contract; that is a design change to Phases 4 / 7, recorded for the backlog.
- P14-F3 (Info): binding-mismatch refusal also creates a pending approval for the altered input.

## Pre-existing (carried)

PRE-12-1, PRE-13-1..3, feedback-route TS error, ESLint baseline.
