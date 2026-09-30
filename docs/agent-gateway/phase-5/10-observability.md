# Phase 5 — Observability

## Reuses Phase 1's logger, not a new logging stack

`mcp/observability.ts`'s `recordMcpEvent()` writes through the existing `gatewayLogger` (pino) from `lib/agent-gateway/observability/request-log.ts`. Phase 5 introduces no new logging library, no new log destination, and no new log format — every MCP-layer log line is a pino JSON line indistinguishable in shape from Phase 1-4's own gateway logs, just with MCP-specific event names and fields.

## Event kinds (`McpEventKind`)

`mcp_request_received`, `authentication_outcome`, `tool_discovered`, `tool_called`, `authorization_result`, `adapter_started`, `adapter_completed`, `adapter_failed`, `protocol_failure`, `disconnect`, `timeout`. Not every kind is emitted by every code path today (`tool_discovered`/`tool_called`/`disconnect`/`timeout` are reserved for future use — e.g. per-tool `tools/list` discovery logging, or SDK-level disconnect hooks not currently wired) — the type is intentionally slightly broader than current emission sites so a future addition doesn't require a type change, but every currently-emitted kind is exercised by at least one test.

## Fields logged — safe by construction

`requestId`, `connectionId`, `toolName`, `protocolVersion`, `outcome` (`ALLOWED`/`DENIED`/`SUCCESS`/`FAILURE`), `errorCode`, `durationMs`. Never logged: tokens, credentials, signatures, `Authorization` header contents, raw tool call arguments/results, or any payment-adjacent value. This is enforced structurally — `recordMcpEvent()`'s parameter type (`McpEventFields`) simply has no field capable of carrying a credential or raw payload, so there is no accidental-inclusion risk from a future call site passing "everything it has."

## Severity routing

`gatewayLogger.warn(...)` for `outcome: "DENIED"`, `outcome: "FAILURE"`, `adapter_failed`, and `protocol_failure`; `gatewayLogger.info(...)` for everything else (successful auth, successful tool calls, authorization allows). This lets existing log-based alerting (already tuned for Phase 1's `warn`-level gateway events) pick up MCP-layer denials/failures with zero additional configuration.

## Reused metrics counters

`route-handler.ts` increments the SAME Phase 1 metrics (`gateway_requests_total`, `gateway_auth_failure_total`, `gateway_auth_success_total`, `gateway_rate_limited_total`) via the existing `incrementMetric()` helper (`observability/metrics.ts`) — the MCP endpoint's traffic is counted alongside the plain HTTP gateway's traffic under the same metric names, by design (both are the same logical "Agent Gateway" service from an operator's dashboard perspective; splitting them into separate metric names was considered and rejected as premature without a demonstrated need to distinguish transport type in alerting).

## Audit hook

`route-handler.ts` calls the existing `getAuditHook().record(...)` (Phase 1's audit hook, explicitly NOT the Phase 11 audit ledger the master prompt refers to elsewhere) on both the authentication-denied path (`component: "mcp-auth"`) and the successful-completion path (`component: "mcp"`), recording `requestId`, `outcome`, `connectionId`, `statusCode` — no MCP-specific audit schema was invented; this is the exact same audit call shape Phase 1's plain HTTP gateway endpoint already makes for its own requests, with `component` distinguishing the origin.

## What tracing/correlation exists

`requestId` (generated fresh per HTTP request via `generateRequestId()`, the same Phase 1 helper) threads through every log line, every audit record, and every `McpSafeError`'s associated event for that request — enabling full request-scoped correlation across authentication, rate-limiting, tool-call, and adapter-execution log lines without needing a separate MCP-specific correlation id scheme.
