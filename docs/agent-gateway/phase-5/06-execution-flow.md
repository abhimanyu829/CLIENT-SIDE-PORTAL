# Phase 5 — End-to-End Execution Flow

```
External AI platform
    |  HTTPS POST /api/agent-gateway/mcp   (JSON-RPC 2.0 body)
    v
nginx (TLS termination, server_name allowlist)
    v
app/api/agent-gateway/mcp/route.ts   (Next.js Route Handler — POST/GET/DELETE all delegate)
    v
mcp/route-handler.ts: handleMcpRequest(request)
    |
    |  1. AGENT_GATEWAY_MCP_ENABLED check                    -> 503 GATEWAY_DISABLED
    |  2. AGENT_GATEWAY_ENABLED check (Phase 1)               -> 503 GATEWAY_DISABLED
    |  3. validateHostHeader / validateOriginHeader (Phase 5) -> 400 MALFORMED_REQUEST
    |  4. validateMethod / validateContentType /
    |     validateDeclaredContentLength / validateBodySize    -> 400/413 (Phase 1, reused)
    |  5. CompositeAuthenticator.authenticate()  (Phase 1)     -> 401 AUTH_* (normalized)
    |  6. buildRequestContext()                  (Phase 1/2)  -> AgentGatewayRequestContext.machine
    |  7. GatewayRedisRateLimiter.check()         (Phase 1)    -> 429 RATE_LIMITED
    |  8. buildAuthInfoExtra(gatewayContext)      (Phase 5)    -> AuthInfo.extra["abhibhi.trustedIdentity"]
    v
createMcpServerForRequest(...)   (Phase 5, mcp/server.ts)
    |  registers one MCP tool per Phase-3-exposed capability (tool-projection.ts)
    v
new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
server.connect(transport)
transport.handleRequest(request, { authInfo, parsedBody })
    |
    |  SDK parses/validates JSON-RPC envelope, dispatches to the matching
    |  registered method handler (initialize / tools/list / tools/call / etc.)
    v
[for tools/call only] the tool's registered callback (mcp/server.ts):
    |
    |  a. extractTrustedIdentity(extra.authInfo)              -> fail closed if absent/malformed
    |  b. resolveProjectedTool(registry, toolName)             -> re-check exposure/status NOW
    |  c. buildExecutionContext(gatewayContext, ...)           -> AgentExecutionContext (Phase 4 shape)
    |  d. authorizer.authorize(context, capability, args, {})  -> Phase 6 hook; FailClosedAuthorizer denies in production
    |  e. AdapterResolver.execute(id@vN, args, gatewayContext)  -> Phase 4, unmodified
    |  f. wrap result as CallToolResult { structuredContent, content, isError: false }
    |     OR toMcpSafeError(err) -> CallToolResult { content, isError: true }
    v
transport.handleRequest() resolves a Response
route-handler.ts records an audit event, closes transport + server, returns the Response
```

## Why per-request server + transport instances

The transport is constructed with `sessionIdGenerator: undefined` (stateless — matching Phase 1-4's already-fully-stateless design end to end, avoiding any need for a Redis-backed MCP session store). The SDK enforces, at runtime, that a stateless `WebStandardStreamableHTTPServerTransport` can only have `handleRequest()` called once — attempting a second call throws "Stateless transport cannot be reused across requests." `route-handler.ts` therefore builds a fresh `McpServer` + fresh transport for every single HTTP request, connects them, handles exactly one request, and closes both in a `finally` block. There is no shared, long-lived MCP server instance anywhere in this phase — this was a design decision reinforced by a real SDK constraint discovered while writing the integration tests, not an assumption.

## Failure short-circuiting

Every numbered step above that can fail returns immediately with a normalized error response — none of the later steps run. In particular: a request that fails Host/Origin validation never reaches the authenticator; a request that fails authentication never reaches the rate limiter; a request that fails rate limiting never reaches the MCP transport at all (no `McpServer` is even constructed). This ordering matches Phase 1's own plain-HTTP-gateway pipeline exactly — Phase 5 does not reorder or skip any Phase 1 check.

## GET and DELETE

`app/api/agent-gateway/mcp/route.ts` also delegates GET and DELETE to the same `handleMcpRequest()`. Per the MCP Streamable HTTP transport spec, GET is used for an optional server-initiated SSE stream (not exercised in this phase — no capability is ASYNC, `enableJsonResponse: true` is set, and this phase builds no resumability), and DELETE is used for explicit session termination (a no-op here in practice, since sessions are stateless — the SDK's own `handleRequest()` reports the standard "session not found"/method-not-supported response for a stateless server, which is the semantically correct behavior, not a special case Phase 5 had to add).
