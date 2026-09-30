# Phase 5 — Transport & Protocol

## Transport decision: `WebStandardStreamableHTTPServerTransport`

The SDK ships two Streamable HTTP transport implementations:
- `StreamableHTTPServerTransport` — wraps Node's `IncomingMessage`/`ServerResponse`.
- `WebStandardStreamableHTTPServerTransport` — built on Web Standard `Request`/`Response`/`ReadableStream`.

Chosen: the Web-standard variant, because it matches Phase 1's `http-boundary.ts`'s own signature (`handleGatewayRequest(request: Request): Promise<Response>`) exactly — zero adapter/shim layer is needed between a Next.js Route Handler and the transport. The Node-specific transport would have required translating between Next.js's Fetch-API request/response objects and Node's legacy HTTP types, adding a layer this phase's spec explicitly discourages ("the transport is NOT allowed to implement business logic" — and a translation shim is exactly the kind of incidental complexity that invites bugs).

## Streamable HTTP as primary; no SSE fallback built

Per the spec's instruction to use Streamable HTTP as primary and add legacy SSE "only when justified by actual external-client compatibility requirements" — no such requirement has been identified for this phase (no external client integration has been attempted yet), so no separate SSE-only compatibility path was built. The chosen transport does support SSE-based streaming internally as part of the Streamable HTTP spec itself (for server-to-client notifications on a long-lived GET stream), but this phase configures `enableJsonResponse: true`, meaning `tools/call` and `tools/list` responses are always a single JSON body — never an SSE stream — since every registered Phase 4 adapter in this phase is a fast, synchronous call (no `ASYNC` capability exists yet per Phase 4's own docs). This was a deliberate, documented choice, not an oversight; see `08-async-operations.md`'s note on this exact decision along with the bug it prevented (`12-bug-report.md`).

## Session/state model: stateless

`sessionIdGenerator: undefined` on every `WebStandardStreamableHTTPServerTransport` instance — the SDK's own documentation states "If not provided, session management is disabled (stateless mode)."

Rationale, per the spec's "prefer the simplest secure stateless model when sufficient" instruction: Phase 1's gateway is already fully stateless per request — every request is independently authenticated via bearer token or HMAC signature, and no session concept exists anywhere in Phases 1-4. Introducing MCP session state would add pure surface area with no corresponding benefit, and would require Redis-backed session storage to be safe in a multi-instance deployment (the spec explicitly warns against memory-only state in that scenario) — avoided entirely by not needing session state at all.

**Consequence**: one fresh `McpServer` + one fresh `WebStandardStreamableHTTPServerTransport` pair is constructed per incoming HTTP request (see `route-handler.ts`), matching the SDK's own documented stateless example (`examples/server/simpleStatelessStreamableHttp.js`) exactly. A stateless transport instance can only ever handle exactly one `handleRequest()` call — attempting a second throws `"Stateless transport cannot be reused across requests."` This constraint was discovered directly from the SDK's own runtime behavior during Phase 5 test-writing and is now the deliberate, tested shape of every code path that touches the transport (production and tests alike).

## Protocol version handling

Deterministic negotiation, unsupported-version rejection, and `MCP-Protocol-Version` header validation are all handled internally by the SDK's transport — this phase does not reimplement, duplicate, or override any of that logic. No silent downgrade path exists; an unsupported version is rejected by the SDK itself with a protocol-correct error.

## Compatibility matrix

| MCP protocol version | Support |
|---|---|
| 2025-11-25 (latest) | Supported (SDK default negotiation target) |
| 2025-06-18 | Supported |
| 2025-03-26 | Supported (SDK's default negotiated version when a client omits an explicit version) |
| 2024-11-05 | Supported |
| 2024-10-07 | Supported |
| Anything else | Rejected by the SDK with a protocol-correct error |

This table is the SDK's own `SUPPORTED_PROTOCOL_VERSIONS` list (see `02-mcp-sdk-selection.md`), not an app-specific narrowing — Phase 5 does not restrict this further.
