# Phase 5 — Authentication Integration

## No separate identity system

The MCP layer does not maintain a competing identity system. It reuses Phase 1's `CompositeAuthenticator` (bearer or signed-request, exactly as Phase 1/2 already built it) and Phase 2's already-resolved `AgentMachineIdentity`.

## Flow

```
MCP HTTP request
    |
route-handler.ts: transport validation (Host/Origin, method, content-type, body size)
    |
CompositeAuthenticator.authenticate()   -- Phase 1, unmodified
    |
buildRequestContext()                   -- Phase 1/2, unmodified -- produces AgentGatewayRequestContext.machine
    |
GatewayRedisRateLimiter.check()          -- Phase 1, unmodified, keyed by connectionId
    |
buildAuthInfoExtra(gatewayContext)       -- Phase 5: wraps the VERIFIED identity into the SDK's AuthInfo.extra
    |
WebStandardStreamableHTTPServerTransport.handleRequest(req, { authInfo })
    |
mcp/server.ts's tool callback: extractTrustedIdentity(extra.authInfo)
```

## Never trusted

Per the spec's explicit requirement, the following are NEVER read from any client-supplied field, anywhere in this module: `ownerId`, `teamId`, `agentId`, `connectionId`, `permission`, `role`, `environment`. Every one of these is copied exclusively from `AgentGatewayRequestContext.machine`, which itself was populated exclusively from a verified `AgentConnection`/`AgentCredential` row (Phase 2).

`clientInfo` (the MCP protocol's own client self-description, e.g. `{ name: "some-client", version: "1.0" }`) is recorded nowhere as identity — the SDK exposes it via `getClientVersion()`, but this phase's code never calls that method for any authorization or identity decision. It is untrusted metadata, exactly as the master prompt requires.

## The `AuthInfo.extra` carrier

`identity-context.ts`'s `buildAuthInfoExtra()` is the ONE place an `AuthInfo` is ever constructed. It embeds the trusted identity under a namespaced key (`"abhibhi.trustedIdentity"`) rather than any generically-named field, specifically so a forged `extra.clientInfo`-shaped payload (or any other guessable key) can never be mistaken for the real trusted identity — `extractTrustedIdentity()` looks up that exact namespaced key and fails closed (`ExecutionError("FORBIDDEN", ...)`) if it's absent or malformed. Verified by test (`mcp-identity-context.test.ts`: "never reads clientInfo-shaped fields as trusted identity").

## Bearer auth

Reuses Phase 1's bearer mechanism unmodified. The `AuthInfo.token` field passed to the SDK is deliberately left as an empty string in `route-handler.ts` — the raw credential is never re-surfaced past the point Phase 1 already verified it, and no code path in this module reads `AuthInfo.token` for any decision. Verified by test (`mcp-security-extra.test.ts`: "token leakage — a bearer token supplied in the Authorization header never appears in any MCP response body").

## Auth failure normalization

Reuses Phase 1's `toExternalAuthErrorCode()` mapping exactly — an internal failure reason like `CONNECTION_REVOKED` or `CREDENTIAL_EXPIRED` is collapsed to the same external `AUTH_INVALID` before ever reaching the caller, so an attacker probing the MCP endpoint cannot enumerate connection existence/state any more than they could against the plain HTTP gateway endpoint. Verified by test.
