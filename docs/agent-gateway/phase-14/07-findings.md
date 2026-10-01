# Phase 14 — 07 Findings

| Id | Severity | Found by | Finding | Status |
|---|---|---|---|---|
| P14-F1 | Medium | fuzz (I2), seed 20261003 | MCP SDK tool errors produced before a gateway callback runs (schema validation, unknown / disabled tool, output validation) echoed agent-supplied values and key names verbatim: credential-shaped strings, injection payloads and control characters went back into the model context and client transcripts. | Fixed: `mcp/tool-errors.ts` maps them to fixed `INVALID_INPUT` / `CAPABILITY_NOT_FOUND` / `INTERNAL_ERROR` texts (`p14-findings`). |
| P14-F2 | Low | ADV-3, RT-3 | The gate is resource-agnostic, so under ASSISTED autonomy an agent can raise an approval request for a resource it does not own (approving it only yields `RESOURCE_NOT_FOUND`), and a task for a non-owned resource is accepted and fails in the worker. No data or effect crosses tenants; the cost is approver attention and a social-engineering surface (a request naming another customer's ticket id). | Open, documented. Recommendation: an ownership pre-check hook for owner-scoped writes before approval creation (adapter-provided, read-only). |
| P14-F3 | Info | RT-2 | When an approved request exists and the agent sends altered input, the call is refused with `APPROVAL_BINDING_MISMATCH` and a new pending approval for the altered input is also created. Safe (nothing executes without that new approval), but the agent-facing signal does not mention the new request. | Open, documented. |
| P14-F4 | Info (test harness) | full-suite runs | With the CPU-heavy simulation suites in parallel, module-reset-heavy Phase 8 worker tests (1–2 s alone) exceeded the 10 s per-test timeout. | Fixed: `testTimeout` / `hookTimeout` 30 s in `vitest.config.ts`; no assertion changed. |

No invariant was violated by any benign, adversarial, red-team, fuzz or corpus scenario after the P14-F1 fix.
