# Phase 5 — Error Model

## Why a separate error type from Phase 1/3/4's own

Phase 1 has `GatewayError`, Phase 3 has `CapabilityError`, Phase 4 has `ExecutionError` — each scoped to its own layer's concerns. Phase 5 does not reuse any of them as its own primary error type (that would conflate "the shape an MCP tool-call error needs" with "the shape an HTTP gateway error needs," which differ: MCP errors must fit inside a `CallToolResult`, not an HTTP status + JSON body). Instead, `mcp/errors.ts` defines:

- `McpErrorCategory`: `"TRANSPORT" | "PROTOCOL" | "AUTHENTICATION" | "AUTHORIZATION" | "CAPABILITY" | "EXECUTION" | "INTERNAL"`
- `McpSafeError { category, code, message }`
- `toMcpSafeError(err: unknown): McpSafeError` — the ONE function that converts any caught value, from any layer, into this safe shape.
- `AuthorizationDeniedError` — a new error class, thrown exclusively by `CapabilityAuthorizer.authorize()` implementations (see `07-authorization-boundary.md`), deliberately NOT reusing `ExecutionError`'s `FORBIDDEN` code so a future Phase 6 policy denial can be distinguished from a Phase 4 structural denial (e.g. "connection not ACTIVE") in logs/observability, even though both currently render similarly to the calling client.

## The mapping table

| Caught type | Category | Code source |
|---|---|---|
| `AuthorizationDeniedError` | `AUTHORIZATION` | `err.code` (always `"AUTHORIZATION_DENIED"`) |
| `GatewayError` with an `AUTH_*`/`SIGNATURE_INVALID`/`SIGNATURE_EXPIRED`/`REPLAY_DETECTED` code | `AUTHENTICATION` | `err.code` (Phase 1's own code, unchanged) |
| `GatewayError` (any other code) | `TRANSPORT` | `err.code` (Phase 1's own code, unchanged) |
| `CapabilityError` | `CAPABILITY` | `err.code` (Phase 3's own code, unchanged) |
| `ExecutionError` | `EXECUTION` | `err.code` (Phase 4's own code, unchanged) |
| anything else (raw `Error`, string throw, etc.) | `INTERNAL` | fixed `"INTERNAL_ERROR"`, fixed message `"An internal error occurred."` |

The last row is the safety net: an unrecognized error's own `.message` — which might contain a Prisma connection string, a stack fragment, or any other internal detail — is never read or forwarded. Verified by `mcp-errors.test.ts`'s adversarial test that throws `new Error("Prisma: connection string postgres://user:SECRETPASS@host/db")` and asserts the safe message is the fixed generic string, not the original.

## Delivery shape

Inside `mcp/server.ts`'s tool callback, `toMcpSafeError(err)`'s result is rendered as:

```ts
{
  content: [{ type: "text", text: `${safe.code}: ${safe.message}` }],
  isError: true,
}
```

This is the SDK's standard `CallToolResult` error shape — MCP tool-call errors are NOT JSON-RPC protocol-level errors (they don't set the envelope's `error` field); they are successful RPC responses whose `result.isError` is `true`, per the MCP spec's own tool-error convention. Protocol-level failures that occur BEFORE a tool callback ever runs (e.g. a malformed JSON-RPC envelope, an unknown method) are handled entirely by the SDK itself, which does use the JSON-RPC `error` field for those — Phase 5 does not intercept or reshape that layer.

## Failures before the MCP transport is even reached

Anything caught by `route-handler.ts`'s outer `try/catch` (transport validation, authentication, rate limiting, or an unexpected exception before `transport.handleRequest()` runs) is converted via the EXISTING Phase 1 `toGatewayError()`/`toErrorBody()` pair — a plain HTTP JSON error body with the matching HTTP status code (400/401/413/429/503), not an MCP `CallToolResult`. This is correct: at that point in the pipeline, no MCP session has been established at all, so there is no `CallToolResult` context to speak in yet — an HTTP-level error is the only response shape that makes sense.

## Verification

`mcp-errors.test.ts` (9 tests) exercises every row of the mapping table plus the two adversarial "never leak" cases. `mcp-route-handler.test.ts` and `mcp-server-integration.test.ts` exercise the full delivery path end-to-end (both the pre-transport HTTP-error path and the post-transport `CallToolResult`-error path).
