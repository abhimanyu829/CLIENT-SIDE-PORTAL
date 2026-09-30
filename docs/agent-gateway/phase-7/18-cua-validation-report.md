# Phase 7 — Cua Validation Report

Read-only checks against the installed driver on 2026-09-29. No configuration was changed and no `set_config`, permission, or install tool was called.

## CUA facts (from the driver)

| Check | Result |
|---|---|
| `health_report` | `cua-driver 0.30.4 on win32 — ok`; session_active, ax_capability (UIAutomation), screen_capture_capability (D3D11 / WGC) pass; macOS checks skipped |
| `check_permissions` | Medium integrity (non-elevated); UIA available; PostMessage injection available |
| `get_config` | version 0.30.4, capture_mode `ax` (deprecated field), max_image_dimension 1568, experimental_pip false |
| Permission mode | standard (built-in default), as recorded in the Step 0 audit; unchanged |
| `list_windows` | 8 on-screen windows (Kiro, Chrome ×2, Cua overlays, Settings, input host, shell). No "Agent approval" window |

`parseCuaHealthReport()` was checked against the verbatim live output (it is the fixture in `p7-cua-boundary.test.ts`) and returns `READY`, version `0.30.4`.

## BACKEND facts

- No approval request existed (migration unapplied, dev server not running), so there was nothing to present.
- The expected observation for this state is `TARGET_NOT_FOUND` -> `CUA_TARGET_APPLICATION_MISSING`, an environment signal, not a decision.

## BUSINESS facts

None. No business operation was executed.

## Not verified (requires a real human)

The full loop — agent opens the approval page via Cua, a human receives the SMS and approves, the agent observes and retries — needs a running app with applied migrations, Twilio configured, and a human with the phone. The agent did not and must not click Approve or enter a code; doing so would itself be the self-approval the design forbids.
