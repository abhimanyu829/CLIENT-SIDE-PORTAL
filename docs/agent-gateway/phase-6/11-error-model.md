# Phase 6 — Error Model

## Reuses Phase 5's error type, does not invent a new one

Per the spec's "Error Semantics" section: externally, `FORBIDDEN` or a stable capability-level error; internally, a specific reason code. Phase 6 achieves this by reusing Phase 5's existing `AuthorizationDeniedError` (`mcp/errors.ts`) as the sole externally-thrown error type — there is no separate `AuthzError`/`PolicyError` class. `authorization/errors.ts`'s `toAuthorizationError(capabilityId, decision)` is the ONE function that converts an internal `AuthorizationDecision` into that external error.

## The exact external message mapping

| Internal decision | External message (verbatim, always this fixed sentence) |
|---|---|
| `REQUIRES_APPROVAL` | `Capability "{id}" requires an approval decision that is not yet available. Failing closed.` |
| `POLICY_UNAVAILABLE` | `Capability "{id}" could not be authorized because the policy subsystem is unavailable. Failing closed.` |
| `DENY` (any reason code) | `Capability "{id}" is not authorized for this connection.` |

Note that **every** `DENY` reason code — `DEFAULT_DENY_NO_POLICY`, `POLICY_DENY`, `CONNECTION_SUSPENDED`, `CONNECTION_REVOKED`, `CONNECTION_EXPIRED`, `IDENTITY_INVALID`, `ENVIRONMENT_MISMATCH`, etc. — collapses to the exact same generic external sentence. This is deliberate anti-enumeration: an external caller probing the endpoint cannot distinguish "this capability doesn't exist for you" from "your connection is suspended" from "no administrator has configured a policy yet" — all three, and every other deny reason, look identical from outside. This mirrors Phase 1's own `toExternalAuthErrorCode()` anti-enumeration mapping precedent exactly (collapsing `CONNECTION_REVOKED`/`CREDENTIAL_EXPIRED`/etc. to the same external `AUTH_INVALID`).

## Never leaked

- The matched policy's `name` (could describe internal business rules).
- The specific internal `reasonCode`.
- Whether a specific capability, resource, or policy exists at all, beyond the fact that this particular call was not authorized.
- Any stack trace, internal exception message, or database error detail (a raw `Error("connection pool exhausted")` from a DB outage is caught and converted to the fixed `POLICY_UNAVAILABLE` sentence, never re-surfaced).

Verified by `authz-authorizer.test.ts`'s dedicated "the thrown error's message never contains the internal reason code or policy name" test.

## Delivery shape (unchanged from Phase 5)

Because `AuthorizationDeniedError` is the exact type Phase 5's `mcp/server.ts` already catches specifically (`if (err instanceof AuthorizationDeniedError) return errorResult("AUTHORIZATION_DENIED", err.message)`), Phase 6 required **zero changes** to how the error is delivered over MCP — it still renders as a `CallToolResult` with `isError: true` and `content[0].text` = `"AUTHORIZATION_DENIED: {the fixed sentence above}"`, exactly the same shape every Phase 5 test already expects.

## What happens to a non-`AuthorizationDeniedError` exception

If `PolicyEngineAuthorizer.authorize()` were ever to throw something other than `AuthorizationDeniedError` (it currently cannot — the only `throw` in that class is `toAuthorizationError()`'s return value), Phase 5's `mcp/server.ts` outer `catch` would route it through `toMcpSafeError()`, categorizing it as `INTERNAL` and returning the fixed `"An internal error occurred."` message — the same safety net Phase 5 already built, unmodified by this phase.
