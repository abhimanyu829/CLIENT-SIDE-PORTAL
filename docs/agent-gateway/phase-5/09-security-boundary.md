# Phase 5 — Security Boundary

## Transport-level

- **TLS**: terminated at nginx (`abhibhideveloper.online` / `www.abhibhideveloper.online`), matching the existing deployment topology used by every other Agent Gateway endpoint — Phase 5 introduces no new certificate, no new termination point.
- **Host header allowlisting**: `validateHostHeader()` (`transport-security.ts`), gated by `AGENT_GATEWAY_MCP_ALLOWED_HOSTS`. Skipped (not enforced) if unset, matching Phase 1's safe-degradation convention for optional config — documented as a production deployment requirement, not silently assumed.
- **Origin header allowlisting**: `validateOriginHeader()`, gated by `AGENT_GATEWAY_MCP_ALLOWED_ORIGINS`. Only enforced when an `Origin` header is actually present (machine/server-to-server callers typically send none) — this is a browser-context defense (e.g. against a malicious page trying to drive a browser-resident MCP client at this endpoint), not a blanket requirement.
- **Why not the SDK's built-in `allowedHosts`/`allowedOrigins`/`enableDnsRebindingProtection`**: those transport constructor options are marked `@deprecated` in the SDK's own `.d.ts` ("Use external middleware... instead"). Phase 5 followed that guidance and Phase 1's own precedent (`security/headers.ts`) instead of relying on a deprecated SDK feature.
- **Method/content-type/body-size validation**: Phase 1's existing `validateMethod`/`validateContentType`/`validateDeclaredContentLength`/`validateBodySize` are reused unmodified — Phase 5 introduces no parallel or competing validation logic for these concerns.

## Authentication

Fully delegated to Phase 1's `CompositeAuthenticator` (bearer or signed-request) — see `04-authentication-integration.md`. No MCP-specific auth scheme, no API-key-in-query-string convenience, no alternate credential format. Auth failures are normalized through Phase 1's existing `toExternalAuthErrorCode()` mapping so the MCP endpoint cannot be used to enumerate connection state (revoked vs. expired vs. never-existed all collapse to `AUTH_INVALID` externally).

## Identity boundary — the `AuthInfo.extra` carrier

Covered fully in `04-authentication-integration.md`. Restated here as a security property: the SDK's `AuthInfo.token`/`AuthInfo.extra`/`clientInfo` fields are the ONLY channel through which anything crosses from the SDK's world into this application's trusted-identity world, and exactly one field of that channel (`extra["abhibhi.trustedIdentity"]`) is ever read for identity purposes, populated exclusively server-side from an already-verified `AgentGatewayRequestContext.machine`. Verified: `mcp-identity-context.test.ts` — "never reads clientInfo-shaped fields as trusted identity," "fails closed on a forged/malformed extra payload."

## Rate limiting

Phase 1's `GatewayRedisRateLimiter`, keyed by `connectionId` (via `rateLimitKeyFor()`), applied after authentication succeeds and before any MCP protocol handling begins. A single external AI platform issuing many rapid `tools/call` requests through one connection is bounded by the exact same limiter Phase 1's plain HTTP gateway endpoint already uses — no separate, weaker MCP-specific limit exists.

## Multi-tenant isolation

Not re-implemented at the MCP layer — inherited from Phase 4's adapters, which scope every query by the trusted `ownerId`/`teamId` from `AgentExecutionContext` (itself built from the same verified `gatewayContext.machine` the MCP layer also uses). Verified end-to-end through the full MCP call path by `mcp-server-integration.test.ts`'s "cross-tenant isolation through the full MCP call path: connection A cannot read connection B's tenant data."

## Input validation

Not re-implemented — Phase 3's `.strict()` zod schemas remain the single source of truth, invoked by Phase 4's resolver exactly as before. The MCP layer's `inputSchema` on `registerTool()` is advisory (surfaced to the calling client for its own validation/UX), never a substitute for the resolver's own re-validation.

## Dangerous primitives — none introduced

No adapter, tool, or MCP-layer code accepts a raw SQL fragment, a raw Prisma `where` object, a file path, a shell command, or any other unconstrained execution primitive from `tools/call` arguments. Every tool's argument shape is exactly Phase 3's own declared, bounded `inputSchema`. This mirrors Phase 4's "no generic execution mechanism" finding and was re-verified for this phase specifically — no MCP-layer file (`server.ts`, `route-handler.ts`, `tool-projection.ts`, etc.) contains any dynamic property access driven by a client-supplied string used as a Prisma model/method selector or similar.

## Error message safety

Covered fully in `11-error-model.md`. Restated here: `toMcpSafeError()` is the only place a caught exception becomes caller-visible text, and it never surfaces a raw `.message` from an unrecognized error type — verified by `mcp-errors.test.ts`'s "categorizes an unexpected raw Error/exception as INTERNAL, never leaking its message" (using a fabricated Postgres-connection-string-shaped message as the adversarial input).

## Token/credential non-leakage

`AuthInfo.token` is set to `""` in production (`route-handler.ts`) — the raw bearer token is never re-surfaced to this layer at all, let alone echoed in any response. Verified directly by `mcp-security-extra.test.ts`'s "token leakage" test, which supplies a real-shaped 64-character bearer token in the `Authorization` header and asserts it never appears anywhere in the JSON-RPC response body.

## Concurrency safety

Each HTTP request gets an isolated `McpServer` + transport pair (per `06-execution-flow.md`) — there is no shared mutable state between two concurrent requests' tool-call handlers beyond the stateless `CapabilityRegistry`/`AdapterRegistry` instances themselves (both read-only at request time from this layer's perspective). Verified by `mcp-security-extra.test.ts`'s concurrency test: two simultaneous `tools/call` invocations for different resources resolve to the correct, non-cross-contaminated results.

## Revoked-mid-session credentials

Because the transport is stateless and per-request, there is no "session" to revoke mid-flight in the traditional sense — every request re-authenticates from scratch via `CompositeAuthenticator`. `mcp-security-extra.test.ts`'s "revoked credential reuse" test additionally confirms that even if a caller somehow constructs a request with a `connectionStatus: "REVOKED"` context (simulating a race between authentication and execution), the tool-call path still denies rather than executing — defense in depth on top of the fact that `CompositeAuthenticator` itself would already reject a revoked connection at step 2.
