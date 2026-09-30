# Phase 7 — Test Plan (A–U)

| Section | Topic | File(s) |
|---|---|---|
| A | Autonomy levels, default, malformed policy, mandatory gates | p7-autonomy |
| B | Approval state machine | p7-approval-primitives |
| C | Canonical JSON + binding digest (field-by-field) | p7-approval-primitives |
| D | Expiry TTLs and boundary instant | p7-approval-primitives, p7-approval-services, p7-execution-gate |
| E | Human approval: role, session, digest, step-up (missing/wrong/expired/other approver/other request/lockout), delivery failure, duplicates | p7-approval-services |
| F | Anti-self-approval: agent bearer and signed-request credentials refused, approver id only from session | p7-approval-services, p7-admin-routes |
| G | Cua contract, observation mismatch, signal vocabulary, health report parsing, "observation never approves" | p7-cua-boundary |
| H | Escalation resistance: no agent-reachable import of decision functions, no autonomy writes, no approval/autonomy tools | p7-cua-boundary, p7-end-to-end #10 |
| I | Authorization + autonomy precedence | p7-autonomy, p7-execution-gate |
| J | Environment scope and environment change after approval | p7-autonomy, p7-execution-gate |
| K | Resource scope; approval for p1 does not cover p2 | p7-autonomy, p7-end-to-end #6 |
| L | Policy-change races (autonomy version, Phase 6 version, pending stale binding) | p7-execution-gate, p7-end-to-end #7 |
| M | Replay / single use | p7-approval-services, p7-execution-gate |
| N | Concurrent consumption (2, 10) and concurrent creation (10) | p7-approval-services, p7-execution-gate |
| O | Connection lifecycle (suspend after approval, bulk cancel) | p7-execution-gate, p7-approval-services |
| P | DB integrity (unique keys, one decision per request, binding key released on terminal states) | p7-approval-services |
| Q | Error contract leaks nothing | p7-execution-gate, p7-admin-routes |
| R | Fail closed (Phase 6 unavailable/throwing, autonomy store down, approval store down, non-canonical input) | p7-execution-gate |
| S | Redaction | p7-approval-primitives |
| T | Admin HTTP boundary | p7-admin-routes |
| U | End-to-end through the real MCP server | p7-end-to-end (10 scenarios) |

Live Cua checks are in `18-cua-validation-report.md`.
