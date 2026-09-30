# Phase 7 — Cua Integration

Cua Driver (`cua-driver-rs` 0.30.4) was already installed and running before Phase 7. Phase 7 did not build, wrap, replace, reinstall or reconfigure it.

## Deployment reality

Cua is a local desktop daemon (`\\.\pipe\cua-driver`) attached to the agent runtime's MCP client. The Next.js server cannot reach it and must not. So the backend never calls Cua. `human-in-the-loop/cua-contract.ts` only:

- describes the approval surface the runtime should present: `describeApprovalSurface(ref)` -> path `/admin/agent-approvals/<ref>`, expected reference, title fragment "Agent approval";
- interprets what the runtime reports: `evaluateObservationAgainstSurface()` (wrong or missing reference -> `CUA_STATE_MISMATCH`), `toCuaRuntimeSignal()`;
- parses the driver's own `health_report` text: `parseCuaHealthReport()`;
- defines `CuaApprovalBridge`, the interface a runtime implements with its own Cua tools (`launch_app`, `list_windows`, `get_window_state`, `verify_state`).

## What an agent runtime may do with Cua

- check readiness (`health_report`, `check_permissions`)
- open the approval page for a human (`launch_app` with the URL) and verify it is on screen with the right reference
- observe outcomes (e.g. that the page now reads APPROVED) as advisory information
- report environment failures using the `CUA_*` signals

## What it must never do

- click Approve, enter the step-up code, or otherwise decide
- create, alter, or consume approval records
- change Cua's permission mode or config
- treat "the screen says Approved" as authorization — the backend gate is the only authority, and it consumes an approval only when the database says APPROVED for the exact binding

`cuaObservationCanGrantApproval()` always returns `false`, and the test suite asserts it.
